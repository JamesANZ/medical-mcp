/**
 * Shared shapes for post-retrieval ranking.
 *
 * Ranking only reorders or drops already-fetched papers. It never diagnoses,
 * doses, or advises.
 */

import type {
  EvidenceGrade,
  EvidenceLevel,
} from "../utils/evidence-grading.js";

/** Pinned JEV version. Do not switch to jev-latest — thresholds are tuned to this. */
export const JEV_MODEL = "jev-1.13.0";

/** How much abstract we send to JEV. Full PMC text is never sent. */
export const ABSTRACT_CHAR_LIMIT = 500;

/** How many JEV calls to run at once. */
export const JEV_CONCURRENCY = 6;

/** Milliseconds to wait for one JEV call before giving up. */
export const JEV_TIMEOUT_MS = 3000;

/**
 * A literature hit we can rank. Matches PubMed articles and the
 * rank-search-hits tool input. Extra fields (pmid, full_text, …) are kept
 * on the object but never sent to JEV.
 */
export type RankHit = {
  title: string;
  abstract?: string;
  journal?: string;
  /** Publication date. PubMed uses publication_date; the tool uses date. */
  date?: string;
  publication_date?: string;
  pmid?: string;
  url?: string;
  authors?: string[] | string;
  pmc_id?: string;
  doi?: string;
  full_text?: string;
};

/**
 * What we send to JEV about one paper. No authors, no full text, no patient IDs.
 */
export type JevState = {
  question: string;
  title: string;
  abstract: string;
  journal?: string;
  date?: string;
  publication_type?: EvidenceLevel;
  evidence_grade?: EvidenceGrade;
};

/**
 * Numbers JEV returns for one paper. Noul values are 0–1 (no → yes).
 * study_design is 0–5 on the ladder in medical-questions.ts.
 */
export type JevScores = {
  addresses: number;
  usable_as_citation: number;
  off_population_or_setting: number;
  study_design: number;
  human_clinical: number;
};

/**
 * Ranking decision attached to a hit. Shown as a compact line, not a prose rewrite.
 */
export type RankAnnotation = {
  keep: boolean;
  addresses: number;
  usable_as_citation: number;
  /** 0–1 design/quality score used in the sort (existing grade or JEV). */
  evidence_or_authority: number;
  flags: string[];
  model: typeof JEV_MODEL;
  degraded?: boolean;
};

export type RankedHit<T extends RankHit = RankHit> = T & {
  rank: RankAnnotation;
};

export type RankHitsResult<T extends RankHit = RankHit> = {
  kept: RankedHit<T>[];
  omitted: RankedHit<T>[];
  degraded: boolean;
  question: string;
};

/** Compact row for papers that missed the top cut. */
export type OmittedHitSummary = {
  title: string;
  pmid?: string;
  url?: string;
  reason: "off_question" | "over_cap";
};

/**
 * Extra lines on a ranked MCP response (omit count + disclaimer).
 */
export type RankDisplayMeta = {
  omitted: number;
  degraded?: boolean;
  omittedHits?: OmittedHitSummary[];
};
