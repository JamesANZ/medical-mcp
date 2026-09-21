/**
 * Compact rank lines and the disclaimer we add only when ranking ran.
 */

import type {
  RankAnnotation,
  RankDisplayMeta,
  RankedHit,
  RankHit,
  OmittedHitSummary,
} from "./types.js";
import { EVIDENCE_TAG_DISCLAIMER } from "../utils/evidence-grading.js";

export const RANK_FOOTER =
  `Ranked for relevance to the stated question. Scores are retrieval signals, not a clinical conclusion. ${EVIDENCE_TAG_DISCLAIMER} This is not medical advice.`;

/**
 * One short line under a paper. Does not replace the title or abstract.
 */
export function formatRankLine(rank: RankAnnotation): string {
  const flags = rank.flags.length > 0 ? ` [${rank.flags.join(", ")}]` : "";
  const degraded = rank.degraded ? " degraded" : "";
  return `   Rank: addresses=${rank.addresses.toFixed(2)} citation=${rank.usable_as_citation.toFixed(2)} authority=${rank.evidence_or_authority.toFixed(2)}${flags}${degraded}`;
}

export function summarizeOmittedHits<T extends RankHit>(
  hits: RankedHit<T>[],
): OmittedHitSummary[] {
  return hits.map((hit) => {
    const url =
      hit.url ||
      (hit.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${hit.pmid}/` : undefined);
    return {
      title: hit.title,
      pmid: hit.pmid,
      url,
      reason: hit.rank.flags.includes("over_cap") ? "over_cap" : "off_question",
    };
  });
}

function formatAlsoRetrieved(hits: OmittedHitSummary[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((hit) => {
    const why =
      hit.reason === "over_cap"
        ? "not in top results"
        : "scored as off-topic";
    const id = hit.pmid ? `PMID ${hit.pmid}` : hit.url || "";
    const idPart = id ? ` (${id})` : "";
    return `- **${hit.title}**${idPart} — ${why}`;
  });
  return `\n\n## Also retrieved\n${lines.join("\n")}`;
}

/**
 * Also-retrieved list + ranking footer. Call only when the user asked to rank.
 */
export function appendRankFooter(text: string, meta: RankDisplayMeta): string {
  let out = text.replace(/\s*$/, "");
  if (meta.omittedHits && meta.omittedHits.length > 0) {
    out += formatAlsoRetrieved(meta.omittedHits);
  } else if (meta.omitted > 0) {
    out += `\n\nOmitted as off-question (${meta.omitted})`;
  }
  if (meta.degraded) {
    out += `\nRanking degraded; original order kept.`;
  }
  out += `\n\n${RANK_FOOTER}`;
  return out;
}
