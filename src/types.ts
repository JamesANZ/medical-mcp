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

// PBS (Pharmaceutical Benefits Scheme) Types
export type PBSSchedule = {
  schedule_code: number;
  effective_date: string;
  effective_month: string;
  effective_year: number;
  publication_status: string;
  revision_number: number;
  start_tsp?: string;
};

export type PBSItem = {
  itemCode: string;
  itemName: string;
  manufacturer: string;
  strength: string;
  packSize: string;
  unitOfMeasure: string;
  atcCode?: string;
  scheduleCode: string;
  effectiveDate: string;
  maxQuantity?: number;
  maxRepeats?: number;
  restrictionCode?: string;
};

export type PBSRestriction = {
  restrictionCode: string;
  restrictionType: string;
  description: string;
  clinicalCriteria?: string;
  prescribingCriteria?: string;
  effectiveDate: string;
  itemCode?: string;
};

export type PBSCopayment = {
  concessionType: string;
  copaymentAmount: number;
  effectiveDate: string;
  description?: string;
};

export type PBSFee = {
  feeType: string;
  amount: number;
  effectiveDate: string;
  description?: string;
};

export type PBSProgram = {
  programCode: string;
  programName: string;
  description?: string;
  effectiveDate: string;
  status: string;
};

export type PBSOrganisation = {
  organisationCode: string;
  organisationName: string;
  organisationType: string;
  address?: string;
  contactInfo?: string;
};

export type PBSSearchResult = {
  pbs_code: string;
  drug_name: string;
  brand_name: string;
  li_drug_name: string;
  li_form: string;
  pack_size: number;
  manufacturer: any;
  schedule?: PBSSchedule;
  li_item_id?: string;
  program_code?: string;
  benefit_type_code?: string;
  [key: string]: any; // Allow for additional fields from the API
};
