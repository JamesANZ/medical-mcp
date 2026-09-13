import superagent from "superagent";
import {
  TINYFISH_API_KEY,
  TINYFISH_SEARCH_API_BASE,
  USER_AGENT,
} from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { skippedHealth, timedHealthCheck } from "../http.js";
import type { LiteratureItem, SearchOpts, SourceAdapter } from "../types.js";

export function hasTinyFishKey(): boolean {
  return Boolean(TINYFISH_API_KEY);
}

type TinyFishResult = {
  title?: string;
  snippet?: string;
  url?: string;
  authors?: string | string[];
  venue?: string;
  year?: number | string;
  citation_count?: number;
  pdf_url?: string;
  site_name?: string;
};

export function mapTinyFishResult(
  row: TinyFishResult,
  source = "TinyFish",
): LiteratureItem {
  const authors = Array.isArray(row.authors)
    ? row.authors.join(", ")
    : row.authors;
  return {
    source,
    title: row.title || "Untitled",
    authors,
    abstract: row.snippet,
    journal: row.venue || row.site_name,
    year: row.year !== undefined ? String(row.year) : undefined,
    citations:
      typeof row.citation_count === "number"
        ? `${row.citation_count} citations`
        : undefined,
    url: row.url,
    pdfUrl: row.pdf_url,
  };
}

export async function searchTinyFish(
  query: string,
  opts: SearchOpts = {},
): Promise<LiteratureItem[]> {
  if (!hasTinyFishKey()) return [];

  const domainType = String(opts.extra?.domainType || "research_paper");
  const includeDomains = opts.extra?.includeDomains
    ? String(opts.extra.includeDomains)
    : undefined;
  const location = opts.extra?.location ? String(opts.extra.location) : undefined;
  const purpose =
    String(opts.extra?.purpose || "") ||
    "Find authoritative medical literature, guidelines, or regulator pages";

  try {
    const res = await resilientCall("TinyFish", async () =>
      superagent
        .get(TINYFISH_SEARCH_API_BASE)
        .query({
          query,
          domain_type: domainType,
          purpose,
          ...(includeDomains ? { include_domains: includeDomains } : {}),
          ...(location ? { location } : {}),
        })
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const rows = (res.body?.results || []) as TinyFishResult[];
    const limit = opts.limit ?? rows.length;
    return rows.slice(0, limit).map((row) => mapTinyFishResult(row));
  } catch (error) {
    logger.warn(
      "TinyFish",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const tinyFishSearchAdapter: SourceAdapter<LiteratureItem> = {
  id: "tinyfish-search",
  name: "TinyFish Search",
  country: "INTL",
  domain: "literature",
  access: "rest",
  requiresKey: true,
  search: searchTinyFish,
  healthCheck: () => {
    if (!hasTinyFishKey()) {
      return Promise.resolve(
        skippedHealth("TINYFISH_API_KEY not set — using other literature sources"),
      );
    }
    return timedHealthCheck(async () => {
      await superagent
        .get(TINYFISH_SEARCH_API_BASE)
        .query({ query: "aspirin", domain_type: "research_paper" })
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .timeout({ response: 10_000, deadline: 15_000 });
    });
  },
};
