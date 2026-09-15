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

const INTERVENTION_HINTS = new Set([
  "immunotherapy",
  "immuno-therapy",
  "chemotherapy",
  "chemo",
  "radiotherapy",
  "radiation",
  "vaccine",
  "vaccination",
  "antibody",
  "antibodies",
  "inhibitor",
  "inhibitors",
  "transplant",
  "transplantation",
  "placebo",
  "steroid",
  "steroids",
  "checkpoint",
  "monoclonal",
]);

export function essiePhrase(query: string): string {
  const cleaned = query.trim().replace(/"/g, "");
  return `"${cleaned}"`;
}

export function buildClinicalTrialsQuery(
  query: string,
): Record<string, string> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { "query.term": query.trim() };
  }

  const interventionIdx = tokens.findIndex((token) =>
    INTERVENTION_HINTS.has(token.toLowerCase()),
  );
  if (interventionIdx > 0) {
    const condition = tokens.slice(0, interventionIdx).join(" ");
    const intervention = tokens.slice(interventionIdx).join(" ");
    return {
      "query.cond":
        tokenize(condition).length > 1
          ? essiePhrase(condition)
          : essieAnd(condition),
      "query.intr": essieAnd(intervention),
    };
  }

  if (tokens.length === 1) {
    return { "query.term": essieAnd(query) };
  }

  return { "query.cond": essiePhrase(query) };
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
  const anzIds = new Set<string>();
  for (const trial of trials) {
    if (trial.id && trial.source.startsWith("ANZCTR")) {
      anzIds.add(trial.id);
    }
  }

  const byId = new Map<string, ClinicalTrial>();
  const noId: ClinicalTrial[] = [];
  for (const trial of trials) {
    if (!trial.id) {
      noId.push(trial);
      continue;
    }
    const existing = byId.get(trial.id);
    if (
      !existing ||
      (existing.source.startsWith("ANZCTR") &&
        trial.source === "ClinicalTrials.gov")
    ) {
      byId.set(trial.id, trial);
    }
  }

  return [
    ...[...byId.values()].map((trial) =>
      trial.id && anzIds.has(trial.id) && trial.source === "ClinicalTrials.gov"
        ? { ...trial, source: "ClinicalTrials.gov (AU/NZ site)" }
        : trial,
    ),
    ...noId,
  ];
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
