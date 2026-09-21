import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import { openFdaAnyFieldAnd } from "../query.js";
import type { SafetyEvent, SearchOpts, SourceAdapter } from "../types.js";

type Shortage = {
  proprietary_name?: string;
  generic_name?: string | string[];
  status?: string;
  shortage_reason?: string;
  update_date?: string;
  availability?: string;
  related_info?: string;
  related_info_link?: string;
  company_name?: string;
  presentation?: string;
};

function httpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : undefined;
}

function shortageRecordUrl(row: Shortage, generic?: string): string {
  return (
    httpUrl(row.related_info_link) ||
    httpUrl(row.related_info) ||
    (generic
      ? `https://api.fda.gov/drug/shortages.json?search=generic_name:"${encodeURIComponent(generic)}"&limit=1`
      : "https://api.fda.gov/drug/shortages.json")
  );
}

export function mapShortage(row: Shortage): SafetyEvent {
  const generic = Array.isArray(row.generic_name)
    ? row.generic_name.join(", ")
    : row.generic_name;
  return {
    source: "FDA Shortages",
    country: "US",
    kind: "shortage",
    title: row.proprietary_name || generic || "Drug shortage",
    summary: [
      row.status,
      row.availability,
      row.shortage_reason,
      row.related_info && !httpUrl(row.related_info)
        ? row.related_info
        : undefined,
      row.company_name,
      row.presentation,
    ]
      .filter(Boolean)
      .join(" — "),
    date: row.update_date,
    url: shortageRecordUrl(row, generic),
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
          search: openFdaAnyFieldAnd(
            ["proprietary_name", "generic_name"],
            query,
          ),
          sort: "update_date:desc",
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
