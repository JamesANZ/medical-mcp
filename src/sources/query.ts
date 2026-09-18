import {
  drugSynonyms,
  extractDrugTerms,
  textMentionsDrug,
} from "../utils/drug-names.js";
import {
  INTERVENTION_HINTS,
  TRIAL_LANDMARKS,
  expandTrialConditionTerms,
  matchingTrialLandmarks,
} from "../utils/query-expand.js";
import type { ClinicalTrial, SafetyEvent } from "./types.js";

const LUCENE_SPECIALS = /[\\+\-&|!(){}[\]^"~*?:/]/g;

export function tokenize(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

export function escapeLuceneToken(token: string): string {
  return token.replace(LUCENE_SPECIALS, "\\$&");
}

export function openFdaAnd(
  field: string,
  queryOrTokens: string | string[],
): string {
  const tokens = Array.isArray(queryOrTokens)
    ? queryOrTokens
    : tokenize(queryOrTokens);
  if (tokens.length === 0) {
    return `${field}:""`;
  }
  return tokens
    .map((token) => `${field}:"${escapeLuceneToken(token)}"`)
    .join(" AND ");
}

export function openFdaAnyFieldAnd(
  fields: string[],
  queryOrTokens: string | string[],
): string {
  const tokens = Array.isArray(queryOrTokens)
    ? queryOrTokens
    : tokenize(queryOrTokens);
  if (fields.length === 0) {
    return "";
  }
  if (fields.length === 1) {
    return openFdaAnd(fields[0], tokens);
  }
  return fields.map((field) => `(${openFdaAnd(field, tokens)})`).join(" OR ");
}

export function essieAnd(query: string): string {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return query.trim();
  }
  return tokens
    .map((token) =>
      /[^\w-]/.test(token) ? `"${token.replace(/"/g, "")}"` : token,
    )
    .join(" AND ");
}

export function essiePhrase(query: string): string {
  const cleaned = query.trim().replace(/"/g, "");
  return `"${cleaned}"`;
}

function essieOr(terms: string[]): string {
  const unique = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  return unique
    .map((term) =>
      /\s/.test(term) || /[^A-Za-z0-9-]/.test(term) ? essiePhrase(term) : term,
    )
    .join(" OR ");
}

function stripDrugsFromQuery(query: string, drugTerms: string[]): string {
  let remaining = query;
  for (const drug of drugTerms) {
    for (const alias of drugSynonyms(drug)) {
      remaining = remaining.replace(new RegExp(`\\b${alias}\\b`, "ig"), " ");
    }
  }
  return remaining.replace(/\s+/g, " ").trim();
}

export type AnalyzedTrialQuery = {
  params: Record<string, string>;
  drugTerms: string[];
};

export function analyzeTrialQuery(query: string): AnalyzedTrialQuery {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { params: { "query.term": query.trim() }, drugTerms: [] };
  }

  const drugTerms = extractDrugTerms(query);
  const landmarks = matchingTrialLandmarks(query);
  const acronyms = landmarks.flatMap((landmark) => landmark.acronyms);

  const interventionIdx = tokens.findIndex((token) =>
    INTERVENTION_HINTS.has(token.toLowerCase()),
  );

  if (drugTerms.length > 0) {
    const condition = stripDrugsFromQuery(query, drugTerms);
    const conditionTerms = [
      ...expandTrialConditionTerms(condition),
      ...acronyms,
    ];
    const params: Record<string, string> = {
      "query.intr": essieOr(drugTerms),
    };
    if (conditionTerms.length > 0 && condition) {
      params["query.cond"] = essieOr(conditionTerms);
    }
    return { params, drugTerms };
  }

  if (interventionIdx > 0) {
    const condition = tokens.slice(0, interventionIdx).join(" ");
    const intervention = tokens.slice(interventionIdx).join(" ");
    return {
      params: {
        "query.cond":
          tokenize(condition).length > 1
            ? essiePhrase(condition)
            : essieAnd(condition),
        "query.intr": essieAnd(intervention),
      },
      drugTerms: [],
    };
  }

  if (tokens.length === 1) {
    return { params: { "query.term": essieAnd(query) }, drugTerms: [] };
  }

  return { params: { "query.term": essieAnd(query) }, drugTerms: [] };
}

export function buildClinicalTrialsQuery(
  query: string,
): Record<string, string> {
  return analyzeTrialQuery(query).params;
}

export function trialMatchesDrugTerms(
  trial: ClinicalTrial,
  drugTerms: string[],
): boolean {
  if (drugTerms.length === 0) return true;
  const haystack = [
    trial.title,
    trial.summary,
    trial.acronym,
    trial.sponsor,
    ...(trial.interventions || []),
  ]
    .filter(Boolean)
    .join(" ");
  if (textMentionsDrug(haystack, drugTerms)) return true;
  const lower = haystack.toLowerCase();
  return TRIAL_LANDMARKS.some(
    (landmark) =>
      landmark.drugs.some((drug) => drugTerms.includes(drug)) &&
      landmark.acronyms.some((acronym) =>
        lower.includes(acronym.toLowerCase()),
      ),
  );
}

export function deprioritizeUnknownStatus(
  trials: ClinicalTrial[],
): ClinicalTrial[] {
  return [...trials].sort((a, b) => {
    const aUnknown = (a.status || "").toUpperCase() === "UNKNOWN" ? 1 : 0;
    const bUnknown = (b.status || "").toUpperCase() === "UNKNOWN" ? 1 : 0;
    return aUnknown - bUnknown;
  });
}

export function dedupeBy<T>(
  items: T[],
  keyFn: (item: T) => string | undefined,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) {
      result.push(item);
      continue;
    }
    const normalized = key.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
  }
  return result;
}

export function dedupeTrials(trials: ClinicalTrial[]): ClinicalTrial[] {
  return dedupeBy(trials, (trial) => trial.id);
}

export function shortageDedupeKey(event: SafetyEvent): string {
  return `${(event.title || "").trim().toLowerCase()}|${event.date || ""}`;
}

export function dedupeSafetyEvents(events: SafetyEvent[]): SafetyEvent[] {
  const seenShortage = new Set<string>();
  const result: SafetyEvent[] = [];
  for (const event of events) {
    if (event.kind !== "shortage") {
      result.push(event);
      continue;
    }
    const key = shortageDedupeKey(event);
    if (seenShortage.has(key)) continue;
    seenShortage.add(key);
    result.push(event);
  }
  return result;
}
