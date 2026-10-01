import type { ClaimRole, SourceClass } from "./types.js";

const AUTHORITATIVE_HOSTS = [
  "fda.gov",
  "dailymed.nlm.nih.gov",
  "ema.europa.eu",
  "tga.gov.au",
  "canada.ca",
  "who.int",
  "cdc.gov",
];

const SCIENTIFIC_HOSTS = [
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "clinicaltrials.gov",
  "doi.org",
];

const ANECDOTAL_HOSTS = [
  "reddit.com",
  "redd.it",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
];

const CLASS_RANK: Record<SourceClass, number> = {
  authoritative: 6,
  regulatory_surveillance: 5,
  scientific: 4,
  professional: 3,
  anecdotal: 2,
  unclassified: 1,
};

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function hostnameOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function classifyUrl(url?: string): SourceClass {
  const host = hostnameOf(url);
  if (!host) return "unclassified";
  if (ANECDOTAL_HOSTS.some((domain) => hostMatches(host, domain))) {
    return "anecdotal";
  }
  if (AUTHORITATIVE_HOSTS.some((domain) => hostMatches(host, domain))) {
    return "authoritative";
  }
  if (SCIENTIFIC_HOSTS.some((domain) => hostMatches(host, domain))) {
    return "scientific";
  }
  return "unclassified";
}

export function anecdotalPlatform(url?: string): "reddit" | "youtube" | "x" | undefined {
  const host = hostnameOf(url);
  if (!host) return undefined;
  if (hostMatches(host, "reddit.com") || hostMatches(host, "redd.it")) return "reddit";
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be")) return "youtube";
  if (hostMatches(host, "x.com") || hostMatches(host, "twitter.com")) return "x";
  return undefined;
}

export function claimRoleForClass(sourceClass: SourceClass): ClaimRole {
  switch (sourceClass) {
    case "authoritative":
      return "label_or_regulatory_notice";
    case "regulatory_surveillance":
      return "spontaneous_report";
    case "scientific":
      return "study_report";
    case "anecdotal":
      return "anecdotal_report";
    default:
      return "unclassified_web";
  }
}

export function classRank(sourceClass: SourceClass): number {
  return CLASS_RANK[sourceClass];
}

export function framingFor(input: {
  source: string;
  claimRole: ClaimRole;
  sourceClass: SourceClass;
}): string {
  switch (input.claimRole) {
    case "spontaneous_report":
      return "FDA FAERS surveillance. Counts are not incidence and do not prove causation.";
    case "study_report":
      return "Published study record. Evidence tags are automatic labels from the title and abstract, not independently checked grades.";
    case "trial_registry":
      return "Trial registry entry. This is not a study result.";
    case "anecdotal_report":
      if (input.source === "youtube") {
        return "A YouTube video description reported the following. This is unverified public discussion, not a clinical finding.";
      }
      if (input.source === "x") {
        return "An X user reported the following. This is one unverified user report, not a clinical finding.";
      }
      return "A Reddit user reported the following. This is one unverified user report, not a finding that a drug or device causes the symptom.";
    case "label_or_regulatory_notice":
      if (input.sourceClass === "authoritative" && input.source === "web") {
        return "Page on a known agency host. This excerpt is untrusted retrieved text, not a substitute for opening the official page.";
      }
      return "Regulatory or label text. This is not a determination for an individual patient.";
    default:
      return "Unclassified web page. This is not clinical evidence.";
  }
}

export function lexicalOverlap(query: string, text: string): number {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return 0;
  const haystack = text.toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return Math.round((hits / tokens.length) * 100) / 100;
}

const LOOKBACK_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export function parseLooseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || /not available/i.test(trimmed)) return undefined;
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const yearMonth = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2]}-01`;
  const year = trimmed.match(/^(\d{4})$/);
  if (year) return `${year[1]}-01-01`;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function isOutsideLookback(
  publishedAt: string | undefined,
  lookback: string,
  now: Date,
): boolean {
  if (!publishedAt || lookback === "all") return false;
  const days = LOOKBACK_DAYS[lookback];
  if (!days) return false;
  const published = Date.parse(`${publishedAt}T00:00:00Z`);
  if (Number.isNaN(published)) return false;
  return published < now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) parsed.searchParams.delete(key);
    }
    const path = parsed.pathname.replace(/\/$/, "") || "/";
    const search = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${search ? `?${search}` : ""}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
