const ORG_ALIASES: Record<string, string[]> = {
  aap: ["american academy of pediatrics", "american academy pediatric"],
  who: ["world health organization"],
  cdc: ["centers for disease control"],
  aha: ["american heart association"],
  acc: ["american college of cardiology"],
  ada: ["american diabetes association"],
  acp: ["american college of physicians"],
  ish: ["international society of hypertension"],
  esc: ["european society of cardiology"],
  nice: ["national institute for health and care excellence"],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesAlias(text: string, aliases: string[]): boolean {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias));
}

/**
 * Short acronyms like "WHO" must not match common English "who" in abstracts
 * (e.g. "clinicians who deliver most of the primary care").
 */
export function organizationFilterMatches(
  organizationFilter: string,
  fields: {
    organization: string;
    title: string;
    abstract?: string;
    journal?: string;
  },
): boolean {
  const filter = organizationFilter.trim();
  if (!filter) return true;

  const filterLower = filter.toLowerCase();
  const aliases = ORG_ALIASES[filterLower] || [];
  const isShort = filterLower.length <= 4 || ORG_ALIASES[filterLower] != null;

  const org = fields.organization || "";
  const title = fields.title || "";
  const journal = fields.journal || "";
  const abstract = fields.abstract || "";

  if (filterLower === "who") {
    const whoField = (text: string) =>
      /\bWHO\b/.test(text) || /world health organization/i.test(text);
    return (
      whoField(org) || whoField(title) || whoField(journal) || whoField(abstract)
    );
  }

  if (isShort) {
    const word = new RegExp(`\\b${escapeRegex(filter)}\\b`, "i");
    return (
      word.test(org) ||
      word.test(title) ||
      word.test(journal) ||
      includesAlias(org, aliases) ||
      includesAlias(title, aliases) ||
      includesAlias(journal, aliases) ||
      includesAlias(abstract, aliases)
    );
  }

  const needle = filterLower;
  return (
    org.toLowerCase().includes(needle) ||
    title.toLowerCase().includes(needle) ||
    journal.toLowerCase().includes(needle) ||
    abstract.toLowerCase().includes(needle)
  );
}

export const ORG_EXTRACTION_PATTERNS: RegExp[] = [
  /(American|European|National|International|World|Global)\s[\w\s]{0,60}?(Association|College|Society|Academy|Institute|Foundation|Organization|Committee|Ministry)/g,
  /World Health Organization/g,
  /\bWHO\b/g,
  /Centers for Disease Control(?: and Prevention)?/g,
  /\bCDC\b/g,
  /National Institutes of Health/g,
  /\bNIH\b/g,
];
