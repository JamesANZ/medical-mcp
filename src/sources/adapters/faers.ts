import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { SafetyEvent, SearchOpts, SourceAdapter } from "../types.js";

type FaersEvent = {
  receiptdate?: string;
  serious?: string;
  patient?: {
    reaction?: Array<{ reactionmeddrapt?: string }>;
    drug?: Array<{ medicinalproduct?: string }>;
  };
};

export function mapFaersEvent(event: FaersEvent, query: string): SafetyEvent {
  const reactions = (event.patient?.reaction || [])
    .map((row) => row.reactionmeddrapt)
    .filter((name): name is string => Boolean(name));
  const drugs = (event.patient?.drug || [])
    .map((row) => row.medicinalproduct)
    .filter((name): name is string => Boolean(name));
  return {
    source: "FDA FAERS",
    country: "US",
    kind: "adverse_event",
    title: reactions[0] || `Adverse event report for ${query}`,
    summary: [
      drugs.length ? `Drugs: ${drugs.slice(0, 5).join(", ")}` : "",
      reactions.length ? `Reactions: ${reactions.slice(0, 5).join(", ")}` : "",
      event.serious === "1" ? "Serious report" : "",
    ]
      .filter(Boolean)
      .join(". "),
    date: event.receiptdate,
    url: `https://open.fda.gov/apis/drug/event/`,
  };
}

async function searchFaers(
  query: string,
  opts: SearchOpts = {},
): Promise<SafetyEvent[]> {
  const limit = opts.limit ?? 10;
  try {
    const res = await resilientCall("FAERS", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/event.json`)
        .query({
          search: `patient.drug.medicinalproduct:${query}`,
          limit,
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const rows = (res.body?.results || []) as FaersEvent[];
    return rows.map((row) => mapFaersEvent(row, query));
  } catch (error) {
    logger.warn(
      "FAERS",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const faersAdapter: SourceAdapter<SafetyEvent> = {
  id: "fda-faers",
  name: "FDA FAERS",
  country: "US",
  domain: "safety",
  access: "rest",
  requiresKey: false,
  search: searchFaers,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${FDA_API_BASE}/drug/event.json`)
        .query({ search: "patient.drug.medicinalproduct:aspirin", limit: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
