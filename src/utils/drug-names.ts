const NAMED_DRUGS: Record<string, string[]> = {
  semaglutide: ["semaglutide", "ozempic", "wegovy", "rybelsus"],
  tirzepatide: ["tirzepatide", "mounjaro", "zepbound"],
  liraglutide: ["liraglutide", "victoza", "saxenda"],
  nirsevimab: ["nirsevimab", "beyfortus"],
  palivizumab: ["palivizumab", "synagis"],
  metformin: ["metformin", "glucophage"],
  atorvastatin: ["atorvastatin", "lipitor"],
  warfarin: ["warfarin", "coumadin"],
  apixaban: ["apixaban", "eliquis"],
  rivaroxaban: ["rivaroxaban", "xarelto"],
  dabigatran: ["dabigatran", "pradaxa"],
  edoxaban: ["edoxaban", "lixiana", "savaysa"],
};

/** INN-like suffixes that almost always mark a drug token in a mixed query. */
const DRUG_SUFFIX =
  /(?:mab|nib|tinib|tide|pril|sartan|statin|olol|prazole|gliptin|gliflozin|glitazone|xaban|parin|ciclib|fenib|caine|cycline|mycin|cillin|conazole|vir)$/i;

const STOPWORDS = new Set([
  "with",
  "and",
  "for",
  "the",
  "in",
  "of",
  "on",
  "to",
  "a",
  "an",
]);

export function escapeWord(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function drugSynonyms(name: string): string[] {
  const lower = name.toLowerCase();
  for (const [generic, aliases] of Object.entries(NAMED_DRUGS)) {
    if (generic === lower || aliases.some((alias) => alias === lower)) {
      return aliases;
    }
  }
  return [lower];
}

function namedDrugHits(queryLower: string): Array<{
  generic: string;
  alias: string;
  index: number;
}> {
  const hits: Array<{ generic: string; alias: string; index: number }> = [];
  for (const [generic, aliases] of Object.entries(NAMED_DRUGS)) {
    for (const alias of aliases) {
      const match = new RegExp(`\\b${escapeWord(alias)}\\b`, "i").exec(
        queryLower,
      );
      if (match && match.index >= 0) {
        hits.push({ generic, alias, index: match.index });
      }
    }
  }
  hits.sort((a, b) => b.alias.length - a.alias.length || a.index - b.index);
  return hits;
}

export function extractDrugTerms(query: string): string[] {
  const lower = query.toLowerCase();
  const used: Array<{ start: number; end: number }> = [];
  const generics = new Set<string>();

  for (const hit of namedDrugHits(lower)) {
    const start = hit.index;
    const end = start + hit.alias.length;
    if (used.some((span) => start < span.end && end > span.start)) continue;
    generics.add(hit.generic);
    used.push({ start, end });
  }

  const tokens = lower.split(/[^\w-]+/).filter(Boolean);
  for (const token of tokens) {
    if (STOPWORDS.has(token) || token.length < 4) continue;
    if (generics.has(token)) continue;
    if (DRUG_SUFFIX.test(token)) {
      generics.add(token);
    }
  }

  return [...generics];
}

export function textMentionsDrug(text: string, drugTerms: string[]): boolean {
  if (drugTerms.length === 0) return true;
  const haystack = text.toLowerCase();
  return drugTerms.some((drug) =>
    drugSynonyms(drug).some((alias) =>
      new RegExp(`\\b${escapeWord(alias)}\\b`, "i").test(haystack),
    ),
  );
}
