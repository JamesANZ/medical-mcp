export const SOURCE_REQUESTS = [
  "authoritative",
  "scientific",
  "web",
  "reddit",
  "youtube",
  "x",
] as const;

export type SourceRequest = (typeof SOURCE_REQUESTS)[number];

export const LOOKBACKS = ["7d", "30d", "90d", "1y", "all"] as const;

export type Lookback = (typeof LOOKBACKS)[number];

export type SourceClass =
  | "authoritative"
  | "regulatory_surveillance"
  | "scientific"
  | "professional"
  | "anecdotal"
  | "unclassified";

export type ClaimRole =
  | "label_or_regulatory_notice"
  | "spontaneous_report"
  | "study_report"
  | "trial_registry"
  | "anecdotal_report"
  | "unclassified_web";

/** Where the hit is printed. Web hits stay in the web section even when the host is an agency. */
export type ResearchSection =
  | "label"
  | "surveillance"
  | "studies"
  | "trials"
  | "web"
  | "discussion";

export type WarningCode =
  | "agent_reach_unavailable"
  | "channel_not_configured"
  | "channel_auth_failed"
  | "channel_rate_limited"
  | "channel_failed"
  | "malformed_results"
  | "no_results"
  | "not_evidence_of_absence"
  | "sections_not_reconciled"
  | "social_not_clinical_evidence"
  | "excerpt_truncated";

export interface ResearchIdentifier {
  type: string;
  value: string;
}

export interface ResearchHit {
  title: string;
  source: string;
  sourceClass: SourceClass;
  claimRole: ClaimRole;
  section: ResearchSection;
  url?: string;
  publishedAt?: string;
  dateUnknown?: boolean;
  excerpt: string;
  excerptTruncated?: boolean;
  framing: string;
  identifiers?: ResearchIdentifier[];
  evidenceTag?: string;
  lexicalOverlap: number;
}

export interface ResearchWarning {
  code: WarningCode;
  source?: string;
  message: string;
}

export interface ResearchSearchOpts {
  limit: number;
  lookback: Lookback;
  now: Date;
}

export interface ProviderOutcome {
  hits: ResearchHit[];
  warnings: ResearchWarning[];
}

export interface ResearchProvider {
  id: string;
  search(query: string, opts: ResearchSearchOpts): Promise<ProviderOutcome>;
}

export interface ResearchReport {
  query: string;
  lookback: Lookback;
  sources: SourceRequest[];
  drugTerms: string[];
  hits: ResearchHit[];
  warnings: ResearchWarning[];
}
