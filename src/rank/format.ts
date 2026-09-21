/**
 * Format rank-search-hits as the same article list shape as PubMed search,
 * plus a compact Rank line and the ranking footer.
 */

import {
  classifyEvidence,
  formatEvidenceTag,
} from "../utils/evidence-grading.js";
import { appendRankFooter, formatRankLine } from "./display.js";
import type { RankHitsResult, RankHit } from "./types.js";

function createMCPResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function authorsLine(authors: RankHit["authors"]): string | undefined {
  if (!authors) return undefined;
  return Array.isArray(authors) ? authors.join(", ") : authors;
}

function formatOneHit(
  hit: RankHit & { rank?: import("./types.js").RankAnnotation },
  index: number,
): string {
  const evidence = classifyEvidence(hit.title, hit.abstract);
  const evidenceStr = formatEvidenceTag(evidence);
  const authors = authorsLine(hit.authors);
  const date = hit.date || hit.publication_date;
  const url =
    hit.url ||
    (hit.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${hit.pmid}/` : undefined);

  let text = `${index + 1}. **${hit.title}**\n`;
  if (evidenceStr) text += `   Evidence: ${evidenceStr}\n`;
  if (hit.rank) text += `${formatRankLine(hit.rank)}\n`;
  if (authors) text += `   Authors: ${authors}\n`;
  if (hit.journal) text += `   Journal: ${hit.journal}\n`;
  if (date) text += `   Publication Date: ${date}\n`;
  if (hit.pmid) text += `   PMID: ${hit.pmid}\n`;
  if (hit.abstract) {
    const clipped =
      hit.abstract.length > 300
        ? `${hit.abstract.slice(0, 300)}...`
        : hit.abstract;
    text += `   Abstract: ${clipped}\n`;
  }
  if (url) text += `   URL: ${url}\n`;
  text += "\n";
  return text;
}

/**
 * MCP text for the rank-search-hits tool.
 */
export function formatRankedSearchHits(
  ranked: RankHitsResult,
  question: string,
) {
  let text = `**Ranked search hits for:** "${question}"\n\n`;
  if (ranked.kept.length === 0) {
    text += `No on-question articles kept.\n`;
  } else {
    text += `Found ${ranked.kept.length} article(s)\n\n`;
    ranked.kept.forEach((hit, index) => {
      text += formatOneHit(hit, index);
    });
  }
  text = appendRankFooter(text, {
    omitted: ranked.omitted.length,
    degraded: ranked.degraded,
  });
  return createMCPResponse(text);
}
