export type SourceDomain =
  | "regulator"
  | "safety"
  | "trials"
  | "literature"
  | "guidelines"
  | "public_health";

export type AccessType = "rest" | "bulk-json" | "soap" | "scrape" | "licensed";

export interface SearchOpts {
  limit?: number;
  country?: string;
  extra?: Record<string, string | number | boolean | undefined>;
}

export interface SourceHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
  skipped?: boolean;
}

export interface SourceAdapter<T> {
  id: string;
  name: string;
  country: string;
  domain: SourceDomain;
  access: AccessType;
  requiresKey: boolean;
  search(query: string, opts?: SearchOpts): Promise<T[]>;
  getById?(id: string): Promise<T | null>;
  healthCheck(): Promise<SourceHealth>;
}

export interface Identifier {
  type: string;
  value: string;
}

export interface RegulatoryProduct {
  source: string;
  country: string;
  productName: string;
  activeIngredients: string[];
  status?: string;
  identifier?: Identifier;
  sponsor?: string;
  dosageForm?: string;
  route?: string;
  url?: string;
}

export interface SafetyEvent {
  source: string;
  country: string;
  kind: "adverse_event" | "recall" | "shortage";
  title: string;
  summary?: string;
  date?: string;
  url?: string;
  id?: string;
}

export interface ClinicalTrial {
  source: string;
  country: string;
  title: string;
  id?: string;
  status?: string;
  sponsor?: string;
  summary?: string;
  startDate?: string;
  url?: string;
  acronym?: string;
  interventions?: string[];
}

export interface LiteratureItem {
  source: string;
  title: string;
  authors?: string;
  abstract?: string;
  journal?: string;
  year?: string;
  citations?: string;
  url?: string;
  pdfUrl?: string;
  doi?: string;
}

export interface FanoutError {
  source: string;
  message: string;
}

export interface FanoutResult<T> {
  items: T[];
  errors: FanoutError[];
}

export interface SourceCatalogRow {
  id: string;
  name: string;
  country: string;
  domain: string;
  access: string;
  requiresKey: boolean;
  tools: string[];
  exposed: boolean;
}
