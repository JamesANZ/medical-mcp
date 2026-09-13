import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { SafetyEvent, SearchOpts, SourceAdapter } from "../types.js";

type Recall = {
  product_description?: string;
  reason_for_recall?: string;
  classification?: string;
  recalling_firm?: string;
  report_date?: string;
  status?: string;
};

export function mapRecall(row: Recall): SafetyEvent {
  return {
    source: "FDA Recalls",
    country: "US",
    kind: "recall",
    title: row.product_description || "FDA drug recall",
    summary: [row.classification, row.reason_for_recall, row.recalling_firm]
      .filter(Boolean)
      .join(" — "),
    date: row.report_date,
    url: "https://open.fda.gov/apis/drug/enforcement/",
  };
}

async function searchRecalls(
  query: string,
  opts: SearchOpts = {},
): Promise<SafetyEvent[]> {
  const limit = opts.limit ?? 10;
  try {
    const res = await resilientCall("FDARecalls", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/enforcement.json`)
        .query({
          search: `product_description:${query}`,
          limit,
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    return ((res.body?.results || []) as Recall[]).map(mapRecall);
  } catch (error) {
    logger.warn(
      "FDARecalls",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const recallsAdapter: SourceAdapter<SafetyEvent> = {
  id: "fda-recalls",
  name: "FDA Recalls",
  country: "US",
  domain: "safety",
  access: "rest",
  requiresKey: false,
  search: searchRecalls,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${FDA_API_BASE}/drug/enforcement.json`)
        .query({ limit: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
