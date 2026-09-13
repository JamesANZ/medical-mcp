/**
 * Semantic Scholar API client
 *
 * Free, reliable fallback for Google Scholar scraping.
 * API: https://api.semanticscholar.org/graph/v1
 * Rate limit: 100 requests/sec (no key needed)
 */

import superagent from "superagent";
import { GoogleScholarArticle } from "../types.js";
import { logger } from "../logger.js";
import { resilientCall } from "../resilience/index.js";
import {
  SemanticScholarSearchResponseSchema,
  safeValidate,
} from "../validation/schemas.js";
import { USER_AGENT, SEMANTIC_SCHOLAR_API_BASE } from "../constants.js";
import { deduplicatePapers } from "./deduplication.js";

/**
 * Search Semantic Scholar for academic papers.
 * Returns results in GoogleScholarArticle format for compatibility.
 */
export async function searchSemanticScholar(
  query: string,
  limit: number = 10,
): Promise<GoogleScholarArticle[]> {
  try {
    const data = await resilientCall("SemanticScholar", async () => {
      const res = await superagent
        .get(`${SEMANTIC_SCHOLAR_API_BASE}/paper/search`)
        .query({
          query,
          limit,
          fields:
            "title,abstract,year,citationCount,url,externalIds,authors,journal,publicationTypes",
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 });

      return res.body;
    });

    const validated = safeValidate(
      SemanticScholarSearchResponseSchema,
      data,
      "SemanticScholar",
    );

    const papers = validated.data || [];

    const results: GoogleScholarArticle[] = papers
      .filter((p) => p.title && p.title.length > 10)
      .map((paper) => ({
        title: paper.title || "",
        authors: (paper.authors || []).map((a) => a.name).join(", "),
        abstract: paper.abstract || undefined,
        journal: paper.journal?.name || undefined,
        year: paper.year ? String(paper.year) : undefined,
        citations: paper.citationCount
          ? `${paper.citationCount} citations`
          : undefined,
        url: paper.url || undefined,
        doi: paper.externalIds?.DOI || undefined,
      }));

    // Deduplicate
    const dedupResult = deduplicatePapers(results);
    return dedupResult.papers as GoogleScholarArticle[];
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("SemanticScholar", `Search failed: ${errMsg}`, { query });
    return [];
  }
}
