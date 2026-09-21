/**
 * Keep / demote / drop rules for ranked hits.
 *
 * JEV only scores the paper. This file decides what to do with those scores.
 * Tune THRESHOLDS in one place — do not scatter magic numbers.
 */

import type { EvidenceLevel, EvidenceTag } from "../utils/evidence-grading.js";
import {
  JEV_MODEL,
  type JevScores,
  type RankAnnotation,
  type RankedHit,
  type RankHit,
} from "./types.js";

/**
 * Starting cutoffs. Easy to retune after looking at real lists.
 *
 * dropAddresses — below this, the abstract does not answer the question
 * dropOffSetting — different population/setting, unless the paper still answers well
 * keepUsable — high enough to treat as a citable keep (else demote, not drop)
 * humanClinicalCap — below this, treat the work as not human; cap design at observational
 */
export const THRESHOLDS = {
  dropAddresses: 0.45,
  dropOffSetting: 0.7,
  dropOffSettingUnlessAddresses: 0.7,
  keepUsable: 0.55,
  humanClinicalCap: 0.4,
  observationalDesignIndex: 3,
  designMax: 5,
  addressesWeight: 0.6,
  designWeight: 0.4,
} as const;

/**
 * Map our existing PubMed study-type tag onto JEV's 0–5 design ladder.
 * Returns null for Unknown so the caller can use JEV instead.
 */
export function designIndexFromEvidence(
  studyType: EvidenceLevel,
): number | null {
  switch (studyType) {
    case "Systematic Review / Meta-Analysis":
      return 5;
    case "Randomized Controlled Trial":
      return 4;
    case "Cohort Study":
    case "Case-Control Study":
      return 3;
    case "Case Report / Case Series":
      return 2;
    case "Expert Opinion / Editorial":
    case "Narrative Review":
      return 1;
    case "Study Protocol":
      return 0;
    case "Unknown":
      return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pick the 0–5 design index: existing evidence tag wins; JEV fills in only
 * when that tag is missing/Unknown. Animal-only work is capped at observational.
 */
export function resolveDesignIndex(
  scores: JevScores,
  evidence?: EvidenceTag,
): number {
  const fromTag =
    evidence && evidence.studyType !== "Unknown"
      ? designIndexFromEvidence(evidence.studyType)
      : null;
  let index =
    fromTag === null || fromTag === undefined
      ? clamp(scores.study_design, 0, THRESHOLDS.designMax)
      : fromTag;

  if (scores.human_clinical < THRESHOLDS.humanClinicalCap) {
    index = Math.min(index, THRESHOLDS.observationalDesignIndex);
  }
  return index;
}

function degradedAnnotation(): RankAnnotation {
  return {
    keep: true,
    addresses: 0,
    usable_as_citation: 0,
    evidence_or_authority: 0,
    flags: ["degraded"],
    model: JEV_MODEL,
    degraded: true,
  };
}

/**
 * When JEV is missing or failed: keep every hit, original order, mark degraded.
 * Nothing is dropped.
 */
export function applyDegradedPolicy<T extends RankHit>(
  hits: T[],
): RankedHit<T>[] {
  return hits.map((hit) => ({
    ...hit,
    rank: degradedAnnotation(),
  }));
}

export type PolicyDecision = RankAnnotation & {
  /** True when the hit survived drop rules but is a weak citation. */
  demote: boolean;
  sortScore: number;
};

/**
 * Decide keep / demote / drop for one paper from JEV scores + optional
 * existing evidence tag. Pure function — no HTTP.
 */
export function applyPolicy(
  scores: JevScores,
  evidence?: EvidenceTag,
): PolicyDecision {
  const flags: string[] = [];
  const designIndex = resolveDesignIndex(scores, evidence);
  const evidenceOrAuthority = designIndex / THRESHOLDS.designMax;
  const sortScore =
    scores.addresses * THRESHOLDS.addressesWeight +
    evidenceOrAuthority * THRESHOLDS.designWeight;

  if (scores.off_population_or_setting > THRESHOLDS.dropOffSetting) {
    flags.push("off_setting");
  }
  if (scores.human_clinical < THRESHOLDS.humanClinicalCap) {
    flags.push("animal_or_invitro");
  }

  const dropForAddress = scores.addresses < THRESHOLDS.dropAddresses;
  const dropForSetting =
    scores.off_population_or_setting > THRESHOLDS.dropOffSetting &&
    scores.addresses < THRESHOLDS.dropOffSettingUnlessAddresses;

  if (dropForAddress || dropForSetting) {
    return {
      keep: false,
      demote: false,
      addresses: scores.addresses,
      usable_as_citation: scores.usable_as_citation,
      evidence_or_authority: evidenceOrAuthority,
      flags,
      model: JEV_MODEL,
      sortScore,
    };
  }

  const demote = scores.usable_as_citation <= THRESHOLDS.keepUsable;
  if (demote) flags.push("low_citation");

  return {
    keep: true,
    demote,
    addresses: scores.addresses,
    usable_as_citation: scores.usable_as_citation,
    evidence_or_authority: evidenceOrAuthority,
    flags,
    model: JEV_MODEL,
    sortScore,
  };
}

type Sortable = {
  rank: RankAnnotation;
  demote?: boolean;
  sortScore?: number;
  originalIndex: number;
};

/**
 * Sort kept hits: real keeps first, then demoted, then by the composite score.
 * originalIndex is the tie-break so degraded batches stay in input order.
 */
export function sortRanked<T extends Sortable>(hits: T[]): T[] {
  return [...hits].sort((a, b) => {
    const aDemote = a.demote ? 1 : 0;
    const bDemote = b.demote ? 1 : 0;
    if (aDemote !== bDemote) return aDemote - bDemote;
    const aScore = a.sortScore ?? 0;
    const bScore = b.sortScore ?? 0;
    if (aScore !== bScore) return bScore - aScore;
    return a.originalIndex - b.originalIndex;
  });
}

/**
 * Strip ranking-only fields before returning hits to formatters.
 */
export function toRankedHit<T extends RankHit>(
  hit: T,
  decision: PolicyDecision,
): RankedHit<T> {
  const { demote: _demote, sortScore: _sortScore, ...rank } = decision;
  return { ...hit, rank };
}
