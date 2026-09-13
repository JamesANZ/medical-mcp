import superagent from "superagent";
import { EUROPE_PMC_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { LiteratureItem, SearchOpts, SourceAdapter } from "../types.js";

type EuropePmcHit = {
  title?: string;
  authorString?: string;
  abstractText?: string;
  journalTitle?: string;
  pubYear?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  citedByCount?: number;
};

export function mapEuropePmcHit(hit: EuropePmcHit): LiteratureItem {
  return {
    source: "Europe PMC",
    title: hit.title || "Untitled",
    authors: hit.authorString,
    abstract: hit.abstractText,
    journal: hit.journalTitle,
    year: hit.pubYear,
    citations:
      typeof hit.citedByCount === "number"
        ? `${hit.citedByCount} citations`
        : undefined,
    doi: hit.doi,
    url: hit.pmid
      ? `https://europepmc.org/article/MED/${hit.pmid}`
      : hit.pmcid
        ? `https://europepmc.org/article/PMC/${hit.pmcid}`
        : "https://europepmc.org/",
  };
}

export async function searchEuropePmc(
  query: string,
  opts: SearchOpts = {},
): Promise<LiteratureItem[]> {
  const limit = opts.limit ?? 10;
  try {
    const res = await resilientCall("EuropePMC", async () =>
      superagent
        .get(`${EUROPE_PMC_API_BASE}/search`)
        .query({
          query,
          format: "json",
          resultType: "core",
          pageSize: limit,
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const rows = (res.body?.resultList?.result || []) as EuropePmcHit[];
    return rows.map(mapEuropePmcHit);
  } catch (error) {
    logger.warn(
      "EuropePMC",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const europePmcAdapter: SourceAdapter<LiteratureItem> = {
  id: "europe-pmc",
  name: "Europe PMC",
  country: "INTL",
  domain: "literature",
  access: "rest",
  requiresKey: false,
  search: searchEuropePmc,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${EUROPE_PMC_API_BASE}/search`)
        .query({
          query: "health",
          format: "json",
          resultType: "lite",
          pageSize: 1,
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
