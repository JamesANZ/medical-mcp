/**
 * Compact rank lines and the disclaimer we add only when ranking ran.
 */

import type { RankAnnotation, RankDisplayMeta } from "./types.js";

export const RANK_FOOTER =
  "Ranked for relevance to the stated question. Scores are retrieval signals, not a clinical conclusion. This is not medical advice.";

/**
 * One short line under a paper. Does not replace the title or abstract.
 */
export function formatRankLine(rank: RankAnnotation): string {
  const flags = rank.flags.length > 0 ? ` [${rank.flags.join(", ")}]` : "";
  const degraded = rank.degraded ? " degraded" : "";
  return `   Rank: addresses=${rank.addresses.toFixed(2)} citation=${rank.usable_as_citation.toFixed(2)} authority=${rank.evidence_or_authority.toFixed(2)}${flags}${degraded}`;
}

/**
 * Omit count + ranking footer. Call only when the user asked to rank.
 */
export function appendRankFooter(text: string, meta: RankDisplayMeta): string {
  let out = text.replace(/\s*$/, "");
  if (meta.omitted > 0) {
    out += `\n\nOmitted as off-question (${meta.omitted})`;
  }
  if (meta.degraded) {
    out += `\nRanking degraded; original order kept.`;
  }
  out += `\n\n${RANK_FOOTER}`;
  return out;
}
