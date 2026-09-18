export type OrgRecord = {
  id: string;
  displayName: string;
  aliases: string[];
};

/**
 * Canonical organisations. Aliases include the full display name plus
 * abbreviations. Matching is longest-first so "American College of Chest
 * Physicians" wins over "American College".
 *
 * ACCP is not mapped on its own: Chest Physicians and Clinical Pharmacy share
 * that acronym.
 */
export const ORGANIZATIONS: OrgRecord[] = [
  {
    id: "aap",
    displayName: "American Academy of Pediatrics",
    aliases: [
      "american academy of pediatrics",
      "american academy pediatric",
      "AAP",
    ],
  },
  {
    id: "who",
    displayName: "World Health Organization",
    aliases: ["world health organization", "WHO"],
  },
  {
    id: "cdc",
    displayName: "Centers for Disease Control and Prevention",
    aliases: [
      "centers for disease control and prevention",
      "centers for disease control",
      "CDC",
    ],
  },
  {
    id: "aha",
    displayName: "American Heart Association",
    aliases: ["american heart association", "AHA"],
  },
  {
    id: "acc",
    displayName: "American College of Cardiology",
    aliases: ["american college of cardiology", "ACC"],
  },
  {
    id: "ada",
    displayName: "American Diabetes Association",
    aliases: ["american diabetes association", "ADA"],
  },
  {
    id: "acp",
    displayName: "American College of Physicians",
    aliases: ["american college of physicians", "ACP"],
  },
  {
    id: "chest",
    displayName: "American College of Chest Physicians",
    aliases: [
      "american college of chest physicians",
      "chest guideline",
      "chest expert panel",
    ],
  },
  {
    id: "ish",
    displayName: "International Society of Hypertension",
    aliases: ["international society of hypertension", "ISH"],
  },
  {
    id: "isth",
    displayName: "International Society on Thrombosis and Haemostasis",
    aliases: [
      "international society on thrombosis and haemostasis",
      "international society on thrombosis and hemostasis",
      "ISTH",
    ],
  },
  {
    id: "esc",
    displayName: "European Society of Cardiology",
    aliases: ["european society of cardiology", "ESC"],
  },
  {
    id: "hrs",
    displayName: "Heart Rhythm Society",
    aliases: ["heart rhythm society", "HRS"],
  },
  {
    id: "chrs",
    displayName: "Canadian Heart Rhythm Society",
    aliases: ["canadian heart rhythm society", "CHRS"],
  },
  {
    id: "sts",
    displayName: "Society of Thoracic Surgeons",
    aliases: ["society of thoracic surgeons", "STS"],
  },
  {
    id: "nice",
    displayName: "National Institute for Health and Care Excellence",
    aliases: ["national institute for health and care excellence", "NICE"],
  },
];

/** Filter shortcuts: abbreviation → lowercase aliases (includes display name). */
export const ORG_ALIASES: Record<string, string[]> = Object.fromEntries(
  ORGANIZATIONS.map((org) => [
    org.id,
    org.aliases.filter((alias) => alias.toLowerCase() !== org.id),
  ]),
);

export const ORG_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  ORGANIZATIONS.map((org) => [org.id, org.displayName]),
);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAcronymAlias(alias: string): boolean {
  return alias.length <= 5 && /^[A-Z]+$/.test(alias);
}

function acronymIsStandalone(
  text: string,
  index: number,
  length: number,
): boolean {
  const before = index > 0 ? text[index - 1] : "";
  const after = text[index + length] || "";
  return before !== "/" && after !== "/";
}

export function aliasWordPattern(alias: string): RegExp {
  // WHO/NICE/ESC and similar must not match ordinary English words.
  const flags = isAcronymAlias(alias) ? "" : "i";
  return new RegExp(`\\b${escapeRegex(alias)}\\b`, flags);
}

function includesAlias(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => aliasWordPattern(alias).test(text));
}

type AliasHit = {
  org: OrgRecord;
  alias: string;
  index: number;
  length: number;
};

function aliasHits(text: string): AliasHit[] {
  const hits: AliasHit[] = [];
  for (const org of ORGANIZATIONS) {
    for (const alias of org.aliases) {
      const pattern = aliasWordPattern(alias);
      const match = pattern.exec(text);
      if (match && match.index >= 0) {
        if (
          isAcronymAlias(alias) &&
          !acronymIsStandalone(text, match.index, match[0].length)
        ) {
          continue;
        }
        hits.push({
          org,
          alias,
          index: match.index,
          length: match[0].length,
        });
      }
    }
  }
  hits.sort((a, b) => b.length - a.length || a.index - b.index);
  return hits;
}

/**
 * Longest-first, word-boundary match against the alias table.
 * Overlapping shorter prefixes of a consumed span are skipped.
 */
export function extractOrganizationName(
  ...parts: Array<string | undefined>
): string {
  const text = parts.filter(Boolean).join(" \n ");
  if (!text.trim()) return "Unknown Organization";

  const hits = aliasHits(text);
  const used: Array<{ start: number; end: number }> = [];
  const matched: OrgRecord[] = [];

  for (const hit of hits) {
    const end = hit.index + hit.length;
    const overlaps = used.some(
      (span) => hit.index < span.end && end > span.start,
    );
    if (overlaps) continue;
    if (matched.some((org) => org.id === hit.org.id)) continue;
    matched.push(hit.org);
    used.push({ start: hit.index, end });
  }

  if (matched.length > 0) {
    return [...new Set(matched.map((org) => org.displayName))].join(" / ");
  }

  const regexMatches: string[] = [];
  for (const pattern of ORG_EXTRACTION_PATTERNS) {
    pattern.lastIndex = 0;
    const found = text.match(pattern);
    if (found) {
      regexMatches.push(...found.filter((value) => value && value.length > 3));
    }
  }
  if (regexMatches.length > 0) {
    regexMatches.sort((a, b) => b.length - a.length);
    return regexMatches[0].replace(/\s+/g, " ").trim();
  }

  return "Unknown Organization";
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
  const known = ORGANIZATIONS.find(
    (org) =>
      org.id === filterLower ||
      org.displayName.toLowerCase() === filterLower ||
      org.aliases.some((alias) => alias.toLowerCase() === filterLower),
  );
  const aliases = known ? known.aliases : ORG_ALIASES[filterLower] || [];
  const isShort = filterLower.length <= 4 || known != null;

  const org = fields.organization || "";
  const title = fields.title || "";
  const journal = fields.journal || "";
  const abstract = fields.abstract || "";

  if (filterLower === "who") {
    const whoField = (text: string) =>
      /\bWHO\b/.test(text) || /world health organization/i.test(text);
    return (
      whoField(org) ||
      whoField(title) ||
      whoField(journal) ||
      whoField(abstract)
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

/**
 * Fallback when the alias table misses. The optional "of …" group keeps
 * "American College of Chest Physicians" and "European Society of Cardiology"
 * intact instead of stopping at College/Society.
 */
export const ORG_EXTRACTION_PATTERNS: RegExp[] = [
  /(American|European|National|International|World|Global)\s+(?:[A-Z][\w'-]*\s+){0,8}?(Association|College|Society|Academy|Institute|Foundation|Organization|Organisation|Committee|Ministry|Physicians)(?:\s+of(?:\s+(?:the\s+)?[A-Z][\w'-]+){1,8})?/g,
  /World Health Organization/g,
  /\bWHO\b/g,
  /Centers for Disease Control(?: and Prevention)?/g,
  /\bCDC\b/g,
  /National Institutes of Health/g,
  /\bNIH\b/g,
];
