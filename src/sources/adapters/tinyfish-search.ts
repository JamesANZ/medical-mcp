import superagent from "superagent";
import {
  TINYFISH_API_KEY,
  TINYFISH_SEARCH_API_BASE,
  USER_AGENT,
} from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { hasMonidKey, monidRun } from "../monid.js";
import { skippedHealth, timedHealthCheck } from "../http.js";
import type { LiteratureItem, SearchOpts, SourceAdapter } from "../types.js";

export function hasTinyFishKey(): boolean {
  return hasMonidKey() || Boolean(TINYFISH_API_KEY);
}

type TinyFishResult = {
  title?: string;
  snippet?: string;
  url?: string;
  authors?: string | string[];
  venue?: string;
  year?: number | string;
  citation_count?: number;
  cited_by_count?: number;
  pdf_url?: string;
  site_name?: string;
};

export function extractTinyFishResults(output: unknown): TinyFishResult[] {
  if (!output) return [];
  if (Array.isArray(output)) return output as TinyFishResult[];
  if (typeof output === "object" && output && "results" in output) {
    const rows = (output as { results?: unknown }).results;
    return Array.isArray(rows) ? (rows as TinyFishResult[]) : [];
  }
  return [];
}

export function mapTinyFishResult(
  row: TinyFishResult,
  source = "Monid TinyFish",
): LiteratureItem {
  const authors = Array.isArray(row.authors)
    ? row.authors.join(", ")
    : row.authors;
  const citationCount = row.cited_by_count ?? row.citation_count;
  return {
    source,
    title: row.title || "Untitled",
    authors,
    abstract: row.snippet,
    journal: row.venue || row.site_name,
    year: row.year !== undefined ? String(row.year) : undefined,
    citations:
      typeof citationCount === "number"
        ? `${citationCount} citations`
        : undefined,
    url: row.url,
    pdfUrl: row.pdf_url,
  };
}

export function buildTinyFishQueryParams(
  query: string,
  opts: SearchOpts = {},
): Record<string, string> {
  const domainType = String(opts.extra?.domainType || "research_paper");
  const includeDomains = opts.extra?.includeDomains
    ? String(opts.extra.includeDomains)
    : undefined;
  const location = opts.extra?.location
    ? String(opts.extra.location)
    : undefined;
  const purpose =
    String(opts.extra?.purpose || "") ||
    "Find authoritative medical literature, guidelines, or regulator pages";
  return {
    query,
    domain_type: domainType,
    purpose,
    ...(includeDomains ? { include_domains: includeDomains } : {}),
    ...(location ? { location } : {}),
  };
}

export function toMonidSearchInput(query: string, opts: SearchOpts = {}) {
  return { queryParams: buildTinyFishQueryParams(query, opts) };
}

export async function searchTinyFish(
  query: string,
  opts: SearchOpts = {},
): Promise<LiteratureItem[]> {
  if (!hasTinyFishKey()) return [];
  const queryParams = buildTinyFishQueryParams(query, opts);

  try {
    let rows: TinyFishResult[] = [];
    if (hasMonidKey()) {
      const output = await monidRun(
        "tinyfish",
        "/search",
        toMonidSearchInput(query, opts),
        "MonidSearch",
      );
      rows = extractTinyFishResults(output);
    } else {
      const res = await resilientCall("TinyFish", async () =>
        superagent
          .get(TINYFISH_SEARCH_API_BASE)
          .query(queryParams)
          .set("User-Agent", USER_AGENT)
          .set("X-API-Key", TINYFISH_API_KEY)
          .timeout({ response: 15_000, deadline: 30_000 }),
      );
      rows = extractTinyFishResults(res.body);
    }
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
  name: "Monid TinyFish Search",
  country: "INTL",
  domain: "literature",
  access: "rest",
  requiresKey: true,
  search: searchTinyFish,
  healthCheck: () => {
    if (!hasTinyFishKey()) {
      return Promise.resolve(
        skippedHealth("MONID_API_KEY not set — using other literature sources"),
      );
    }
    return timedHealthCheck(async () => {
      const pingOpts = { extra: { domainType: "research_paper" } };
      if (hasMonidKey()) {
        await monidRun(
          "tinyfish",
          "/search",
          toMonidSearchInput("aspirin", pingOpts),
          "MonidSearch",
        );
        return;
      }
      await superagent
        .get(TINYFISH_SEARCH_API_BASE)
        .query(buildTinyFishQueryParams("aspirin", pingOpts))
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .timeout({ response: 10_000, deadline: 15_000 });
    });
  },
};
