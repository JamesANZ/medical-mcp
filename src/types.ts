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
  doi?: string;
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

export interface GuidelineScore {
  publicationType: number; // +2 if has [pt] tag
  titleKeywords: number; // +1 for "guideline", "recommendation", "consensus" in title
  journalReputation: number; // +1 for known guideline-publishing journals
  authorAffiliation: number; // +1 for organization pattern match in affiliations
  abstractKeywords: number; // +0.5 for guideline terms in abstract
  meshTerms: number; // +0.5 if has guideline-related MeSH terms
  total: number;
}

export type PediatricGuideline = {
  title: string;
  organization: string;
  year?: string;
  url: string;
  description?: string;
  age_group?: string;
  category?: string;
  source: "bright-futures" | "aap-policy";
  screening_recommendations?: string[];
};

export type PediatricJournalArticle = {
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

export type ChildHealthIndicator = {
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
  AgeGroup?: string;
};
