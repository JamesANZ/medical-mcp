/**
 * Questions we ask JEV about each paper, plus a guard against sending
 * a specific patient's story.
 *
 * These questions only ask "is this paper on-topic?" They never ask whether
 * a treatment works, what to prescribe, or which paper is correct.
 */

import type { JevState } from "./types.js";

/** Ordered rungs for the study_design score (lowest → highest). */
export const STUDY_DESIGN_LEVELS = [
  "Opinion / editorial / news",
  "Narrative review / expert consensus",
  "Case report / series",
  "Observational / pharmacovigilance / cohort",
  "Single randomized trial",
  "Systematic review or meta-analysis of RCTs",
] as const;

/**
 * The five JEV questions, asked together in one call per paper.
 * Keys match the answers map we parse in the client.
 */
export const JEV_QUESTIONS = {
  addresses_question: {
    type: "noul" as const,
    instructions:
      "The document's abstract reports findings or recommendations that directly address `question`. Keyword overlap alone is not enough. Mentions of the drug or disease in a different clinical setting (anesthesia, adverse-event mining, perioperative hold) count as no unless the abstract answers the question. A primary randomized trial of the named intervention and outcome does address the question even if the abstract never uses a trial acronym (for example SELECT).",
  },
  usable_as_citation: {
    type: "noul" as const,
    instructions:
      "A researcher could cite this document as evidence about this question, not merely as background.",
  },
  off_population_or_setting: {
    type: "noul" as const,
    instructions:
      "The population, indication, or setting is materially different from the one in `question`.",
  },
  study_design: {
    type: "score" as const,
    instructions:
      "Rate the study design of this document. Use only the title and abstract. Do not judge whether the findings are true.",
    criteria: [...STUDY_DESIGN_LEVELS],
  },
  human_clinical: {
    type: "noul" as const,
    instructions: "The work is in humans (not in vitro / animal-only).",
  },
};

const AGE_PATTERN =
  /\b\d{1,3}\s*-?\s*(?:yo|y\/o|year-?old|years?\s+old|yr(?:s)?(?:\s+old)?|months?\s+old)\b/i;
const PERSONAL_PATTERN =
  /\b(?:my|i['’]m|i am|our patient|this patient|a \d{1,3}\s*-?\s*(?:yo|year))\b/i;

/**
 * True when the text looks like one person's case ("my 64yo with EF 30%")
 * rather than a general clinical question.
 */
export function looksLikeSpecificPatient(question: string): boolean {
  return AGE_PATTERN.test(question) && PERSONAL_PATTERN.test(question);
}

/**
 * If the question looks like a specific patient, strip that detail or fall
 * back to the keyword query. Callers should mark the batch as degraded.
 */
export function generalizeQuestion(
  question: string,
  fallbackQuery?: string,
): { question: string; degraded: boolean } {
  const trimmed = question.trim();
  if (!looksLikeSpecificPatient(trimmed)) {
    return { question: trimmed, degraded: false };
  }

  const general = trimmed
    .replace(AGE_PATTERN, " ")
    .replace(
      /\b(?:my|i['’]m|i am|our|this)\s+(?:patient|man|woman|male|female)?\b/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  if (general.length >= 12) {
    return { question: general, degraded: true };
  }
  if (fallbackQuery && fallbackQuery.trim().length >= 3) {
    return { question: fallbackQuery.trim(), degraded: true };
  }
  return { question: "general clinical literature question", degraded: true };
}

/**
 * Build the JSON we send to JEV. Truncates the abstract and never includes
 * authors or full text.
 */
export function buildJevState(
  question: string,
  hit: {
    title: string;
    abstract?: string;
    journal?: string;
    date?: string;
    publication_date?: string;
    publication_type?: JevState["publication_type"];
    evidence_grade?: JevState["evidence_grade"];
  },
  abstractLimit: number,
): JevState {
  const abstract = (hit.abstract || "").slice(0, abstractLimit);
  const date = hit.date || hit.publication_date;
  const state: JevState = {
    question,
    title: hit.title,
    abstract,
  };
  if (hit.journal) state.journal = hit.journal;
  if (date) state.date = date;
  if (hit.publication_type) state.publication_type = hit.publication_type;
  if (hit.evidence_grade) state.evidence_grade = hit.evidence_grade;
  return state;
}
