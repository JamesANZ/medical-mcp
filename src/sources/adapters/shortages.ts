import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { SafetyEvent, SearchOpts, SourceAdapter } from "../types.js";

type Shortage = {
  proprietary_name?: string;
  generic_name?: string | string[];
  status?: string;
  shortage_reason?: string;
  update_date?: string;
};

export function mapShortage(row: Shortage): SafetyEvent {
  const generic = Array.isArray(row.generic_name)
    ? row.generic_name.join(", ")
    : row.generic_name;
  return {
    source: "FDA Shortages",
    country: "US",
    kind: "shortage",
    title: row.proprietary_name || generic || "Drug shortage",
    summary: [row.status, row.shortage_reason].filter(Boolean).join(" — "),
    date: row.update_date,
    url: "https://open.fda.gov/apis/drug/drugshortages/",
  };
}

async function searchShortages(
  query: string,
  opts: SearchOpts = {},
): Promise<SafetyEvent[]> {
  const limit = opts.limit ?? 10;
  try {
    const res = await resilientCall("FDAShortages", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/shortages.json`)
        .query({
          search: `proprietary_name:${query} generic_name:${query}`,
          limit,
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    return ((res.body?.results || []) as Shortage[]).map(mapShortage);
  } catch (error) {
    logger.warn(
      "FDAShortages",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const shortagesAdapter: SourceAdapter<SafetyEvent> = {
  id: "fda-shortages",
  name: "FDA Shortages",
  country: "US",
  domain: "safety",
  access: "rest",
  requiresKey: false,
  search: searchShortages,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${FDA_API_BASE}/drug/shortages.json`)
        .query({ limit: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
