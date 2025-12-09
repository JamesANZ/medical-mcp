export type DrugLabel = {
  openfda: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_ndc?: string[];
    substance_name?: string[];
    route?: string[];
    dosage_form?: string[];
  };
  purpose?: string[];
  warnings?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  dosage_and_administration?: string[];
  clinical_pharmacology?: string[];
  effective_time: string;
};

export type WHOIndicator = {
  IndicatorCode: string;
  IndicatorName: string;
  SpatialDimType: string;
  SpatialDim: string;
  TimeDim: string;
  TimeDimType: string;
  DataSourceDim: string;
  DataSourceType: string;
  Value: number;
  NumericValue: number;
  Low: number;
  High: number;
  Comments: string;
  Date: string;
};

export type RxNormDrug = {
  rxcui: string;
  name: string;
  synonym: string[];
  tty: string;
  language: string;
  suppress: string;
  umlscui: string[];
};

export type PubMedArticle = {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publication_date: string;
  doi?: string;
  pmc_id?: string;
  full_text?: string;
};

export type GoogleScholarArticle = {
  title: string;
  authors?: string;
  abstract?: string;
  journal?: string;
  year?: string;
  citations?: string;
  url?: string;
  pdf_url?: string;
  related_articles?: string[];
};

export type ClinicalGuideline = {
  title: string;
  organization: string;
  year: string;
  url: string;
  description?: string;
  category?: string;
  evidence_level?: string;
};

export type DrugInteraction = {
  drug1: string;
  drug2: string;
  severity: "Minor" | "Moderate" | "Major" | "Contraindicated";
  description: string;
  clinical_effects: string;
  management: string;
  evidence_level: string;
};

export interface GuidelineScore {
  publicationType: number; // +2 if has [pt] tag
  titleKeywords: number; // +1 for "guideline", "recommendation", "consensus" in title
  journalReputation: number; // +1 for known guideline-publishing journals
  authorAffiliation: number; // +1 for organization pattern match in affiliations
  abstractKeywords: number; // +0.5 for guideline terms in abstract
  meshTerms: number; // +0.5 if has guideline-related MeSH terms
  total: number;
}

// Calculator Types
export type CalculatorType =
  // MVP Calculators
  | "bmi"
  | "bsa"
  | "ibw"
  | "chads2-vasc"
  | "creatinine-clearance"
  | "pediatric-dosing-weight"
  // Phase 4 Expansion - Cardiovascular
  | "has-bled"
  // Phase 4 Expansion - Renal
  | "mdrd"
  | "ckd-epi"
  // Phase 4 Expansion - Critical Care
  | "sofa"
  | "qsofa"
  | "wells"
  | "curb65"
  | "child-pugh"
  | "meld"
  | "anion-gap"
  // Phase 4 Expansion - Missing Critical
  | "qtc-correction"
  | "glasgow-coma-scale"
  | "parkland-formula";

export type SafetyWarning = {
  level: "info" | "warning" | "error";
  message: string;
  category?:
    | "contraindication"
    | "overdose"
    | "pregnancy"
    | "pediatric"
    | "geriatric";
};

export type CalculatorResult = {
  value: number;
  unit?: string;
  interpretation?: string;
  warnings?: SafetyWarning[];
  citation?: string;
  formula?: string;
  notes?: string[];
};

export type CalculatorParameters = Record<string, unknown>;

export interface CalculatorFunction {
  (params: CalculatorParameters): CalculatorResult | Promise<CalculatorResult>;
}

export interface CalculatorDefinition {
  name: string;
  description: string;
  parameters: Record<
    string,
    {
      type: "number" | "string" | "boolean";
      description: string;
      required: boolean;
      min?: number;
      max?: number;
      unit?: string;
    }
  >;
  calculate: CalculatorFunction;
  citation?: string;
  formula?: string;
}

// Health.gov Types
export type HealthTopic = {
  id: string;
  title: string;
  description?: string;
  url?: string;
  category?: string;
};

export type PreventiveService = {
  id: string;
  title: string;
  description?: string;
  ageGroup?: string;
  frequency?: string;
  url?: string;
  category?: string;
};
