import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { openFdaAnyFieldAnd, tokenize } from "../query.js";
import { formatCompactDate } from "../../utils/text.js";
import { timedHealthCheck } from "../http.js";
import type { SafetyEvent, SearchOpts, SourceAdapter } from "../types.js";

const FAERS_DRUG_FIELDS = [
  "patient.drug.medicinalproduct",
  "patient.drug.openfda.brand_name",
  "patient.drug.openfda.generic_name",
];

type FaersEvent = {
  safetyreportid?: string;
  receiptdate?: string;
  serious?: string;
  patient?: {
    reaction?: Array<{ reactionmeddrapt?: string }>;
    drug?: Array<{ medicinalproduct?: string }>;
  };
};

type FaersCountRow = {
  term?: string;
  count?: number;
};

function promoteQueryMatches(drugs: string[], query: string): string[] {
  const tokens = tokenize(query).map((token) => token.toLowerCase());
  if (tokens.length === 0) return drugs;
  const matches: string[] = [];
  const rest: string[] = [];
  for (const drug of drugs) {
    const lower = drug.toLowerCase();
    if (tokens.some((token) => lower.includes(token))) {
      matches.push(drug);
    } else {
      rest.push(drug);
    }
  }
  return [...matches, ...rest];
}

export function mapFaersEvent(event: FaersEvent, query: string): SafetyEvent {
  const reactions = (event.patient?.reaction || [])
    .map((row) => row.reactionmeddrapt)
    .filter((name): name is string => Boolean(name));
  const drugs = promoteQueryMatches(
    (event.patient?.drug || [])
      .map((row) => row.medicinalproduct)
      .filter((name): name is string => Boolean(name)),
    query,
  );
  const tokens = tokenize(query).map((token) => token.toLowerCase());
  const hasQueryDrug =
    tokens.length === 0 ||
    drugs.some((drug) =>
      tokens.some((token) => drug.toLowerCase().includes(token)),
    );
  return {
    source: "FDA FAERS",
    country: "US",
    kind: "adverse_event",
    id: event.safetyreportid,
    title: reactions[0] || `Adverse event report for ${query}`,
    summary: [
      drugs.length ? `Drugs: ${drugs.slice(0, 8).join(", ")}` : "",
      reactions.length ? `Reactions: ${reactions.slice(0, 5).join(", ")}` : "",
      event.serious === "1" ? "Serious report" : "",
      !hasQueryDrug
        ? `Queried drug "${query}" was not among the named products in this report`
        : "",
    ]
      .filter(Boolean)
      .join(". "),
    date: formatCompactDate(event.receiptdate),
    url: event.safetyreportid
      ? `https://api.fda.gov/drug/event.json?search=safetyreportid:"${encodeURIComponent(event.safetyreportid)}"`
      : undefined,
  };
}

export function mapFaersCount(
  row: FaersCountRow,
  query: string,
): SafetyEvent | null {
  const term = row.term?.trim();
  const count = row.count;
  if (!term || !count) return null;
  const search = `${openFdaAnyFieldAnd(FAERS_DRUG_FIELDS, query)} AND patient.reaction.reactionmeddrapt:"${term.replace(/"/g, "")}"`;
  return {
    source: "FDA FAERS",
    country: "US",
    kind: "adverse_event",
    title: term,
    summary: `${count.toLocaleString("en-US")} FAERS reports named this reaction. Counts are not incidence and do not prove causation.`,
    url: `https://api.fda.gov/drug/event.json?search=${encodeURIComponent(search)}&limit=1`,
  };
}

async function searchFaers(
  query: string,
  opts: SearchOpts = {},
): Promise<SafetyEvent[]> {
  const limit = opts.limit ?? 10;
  const search = openFdaAnyFieldAnd(FAERS_DRUG_FIELDS, query);
  try {
    const res = await resilientCall("FAERS", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/event.json`)
        .query({
          search,
          count: "patient.reaction.reactionmeddrapt.exact",
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const rows = (res.body?.results || []) as FaersCountRow[];
    const aggregated = rows
      .map((row) => mapFaersCount(row, query))
      .filter((event): event is SafetyEvent => Boolean(event))
      .slice(0, limit);
    if (aggregated.length > 0) {
      return aggregated;
    }
  } catch (error) {
    logger.warn(
      "FAERS",
      `Count search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const res = await resilientCall("FAERS", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/event.json`)
        .query({
          search,
          sort: "receivedate:desc",
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
