import type { DrugLabel } from "../types.js";

const PEDIATRIC_TERMS = [
  "pediatric",
  "paediatric",
  "child",
  "children",
  "infant",
  "neonat",
  "newborn",
  "adolescent",
];

const LABEL_SECTIONS: Array<keyof DrugLabel | string> = [
  "purpose",
  "warnings",
  "dosage_and_administration",
  "pediatric_use",
  "indications_and_usage",
  "use_in_specific_populations",
  "clinical_pharmacology",
];

function sectionText(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return String(value);
}

export function fdaLabelHasPediatricUse(drug: DrugLabel): boolean {
  const chunks = LABEL_SECTIONS.map((section) =>
    sectionText((drug as Record<string, unknown>)[section as string]),
  );
  const haystack = chunks.join(" ").toLowerCase();
  if (!haystack.trim()) return false;
  return PEDIATRIC_TERMS.some((term) => haystack.includes(term));
}

export function extractPediatricSentence(text: string): string | undefined {
  if (!text?.trim()) return undefined;
  const term =
    /\b(pediatric|paediatric|child|children|infant|infants|neonate|neonatal|neonates|newborn|adolescent|adolescents)\b/i;
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (!term.test(sentence)) continue;
    if (!/^[A-Z("]/.test(sentence)) continue;
    if (sentence.length <= 280) return sentence;
    return `${sentence.slice(0, 277).trimEnd()}...`;
  }
  return undefined;
}

export function pediatricDrugsEmptyMessage(
  query: string,
  labelsRetrieved: number,
): string {
  if (labelsRetrieved === 0) {
    return `No FDA labels were retrieved for "${query}". This can mean the upstream search failed, timed out, or returned no records. It is not evidence that the drug is unapproved or unlabeled for pediatric use.`;
  }
  return `Retrieved ${labelsRetrieved} FDA label(s) for "${query}", but none mentioned pediatric use in the label sections checked (pediatric use, dosing, indications, warnings, purpose). That is a search/filter outcome, not evidence that the drug lacks pediatric approval.`;
}
