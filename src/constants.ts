export const FDA_API_BASE = "https://api.fda.gov";
export const WHO_API_BASE = "https://ghoapi.azureedge.net/api";
export const RXNAV_API_BASE = "https://rxnav.nlm.nih.gov/REST";
export const PUBMED_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
export const PMC_API_BASE = "https://www.ncbi.nlm.nih.gov/pmc";
export const SEMANTIC_SCHOLAR_API_BASE =
  "https://api.semanticscholar.org/graph/v1";
export const TGA_ARTG_API_BASE =
  "https://data.tga.gov.au/ARTGSearch/ARTGWebService.svc/JSON";
export const HEALTH_CANADA_API_BASE =
  "https://health-products.canada.ca/api/drug";
export const EMA_MEDICINES_JSON_URL =
  "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines_json-report_en.json";
export const DAILYMED_API_BASE =
  "https://dailymed.nlm.nih.gov/dailymed/services/v2";
export const CLINICALTRIALS_API_BASE =
  "https://clinicaltrials.gov/api/v2/studies";
export const TINYFISH_SEARCH_API_BASE = "https://api.search.tinyfish.ai";
export const TINYFISH_FETCH_API_BASE = "https://api.fetch.tinyfish.ai";
export const MONID_API_BASE = "https://api.monid.ai";
export const USER_AGENT = "medical-mcp/2.0";
export const MONID_API_KEY = process.env.MONID_API_KEY || "";
export const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY || "";
export const DEFAULT_DRUG_COUNTRIES = ["US", "AU", "CA", "EU"] as const;
export const SUPPORTED_DRUG_COUNTRIES = ["US", "AU", "CA", "EU"] as const;

/**
 * NCBI API Key — optional but increases PubMed rate limit from 3/sec to 10/sec.
 * Set NCBI_API_KEY env var to enable.
 */
export const NCBI_API_KEY = process.env.NCBI_API_KEY || "";

// Controlled vocabulary: PubMed publication types for guidelines
export const GUIDELINE_PUBLICATION_TYPES = [
  '"practice guideline"[pt]',
  '"guideline"[pt]',
  '"consensus development conference"[pt]',
  '"consensus development conference, nih"[pt]',
  '"technical report"[pt]',
];

// Controlled vocabulary: MeSH terms for guidelines
export const GUIDELINE_MESH_TERMS = [
  '"Practice Guidelines as Topic"[mh]',
  '"Guideline Adherence"[mh]',
  '"Clinical Protocols"[mh]',
];

// Controlled vocabulary: Keywords for guideline detection
export const GUIDELINE_KEYWORDS = [
  "guideline",
  "recommendation",
  "consensus",
  "position statement",
  "standard of care",
  "best practice",
  "evidence-based",
  "expert consensus",
];

// Scoring weights for guideline detection
export const GUIDELINE_SCORE_WEIGHTS = {
  PUBLICATION_TYPE: 2,
  TITLE_KEYWORD: 1,
  JOURNAL_REPUTATION: 1,
  AUTHOR_AFFILIATION: 1,
  ABSTRACT_KEYWORD: 0.5,
  MESH_TERM: 0.5,
  MIN_SCORE_THRESHOLD: 2.5, // Minimum score to be considered a guideline
};

// Regex patterns for organization extraction.
// WHO is case-sensitive so it does not match English "who".
export const ORG_EXTRACTION_PATTERNS = [
  /(American|European|National|International|World|Global)\s[\w\s]{0,60}?(Association|College|Society|Academy|Institute|Foundation|Organization|Committee|Ministry)/g,
  /World Health Organization/g,
  /\bWHO\b/g,
  /Centers for Disease Control(?: and Prevention)?/g,
  /\bCDC\b/g,
  /National Institutes of Health/g,
  /\bNIH\b/g,
];

// Pediatric source URLs
export const AAP_BRIGHT_FUTURES_BASE = "https://brightfutures.aap.org";
export const AAP_PUBLICATIONS_BASE = "https://publications.aap.org/pediatrics";

// Major pediatric journals for filtering PubMed searches
export const PEDIATRIC_JOURNALS = [
  "Pediatrics",
  "JAMA Pediatrics",
  "The Journal of Pediatrics",
  "Pediatric Research",
  "Archives of Disease in Childhood",
  "European Journal of Pediatrics",
  "Pediatric Clinics of North America",
];
