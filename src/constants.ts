export const FDA_API_BASE = "https://api.fda.gov";
export const WHO_API_BASE = "https://ghoapi.azureedge.net/api";
export const RXNAV_API_BASE = "https://rxnav.nlm.nih.gov/REST";
export const PUBMED_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
export const PMC_API_BASE = "https://www.ncbi.nlm.nih.gov/pmc";
export const GOOGLE_SCHOLAR_API_BASE = "https://scholar.google.com/scholar";
export const USER_AGENT = "medical-mcp/1.0";

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

// Regex patterns for organization extraction (generic patterns, not hardcoded names)
export const ORG_EXTRACTION_PATTERNS = [
  /(American|European|National|International|World|Global).*?(Association|College|Society|Academy|Institute|Foundation|Organization|Committee|Academy|Society|Ministry)/gi,
  /(World Health Organization|WHO)/gi,
  /(Centers for Disease Control|CDC)/gi,
  /(National Institutes of Health|NIH)/gi,
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

// WHO child health indicator codes (common pediatric indicators)
export const WHO_CHILD_HEALTH_INDICATORS = [
  "MDG_0000000029", // Under-five mortality rate
  "MDG_0000000030", // Infant mortality rate
  "MDG_0000000031", // Neonatal mortality rate
  "MDG_0000000032", // Child mortality rate (1-4 years)
  "MDG_0000000033", // Measles immunization coverage
  "MDG_0000000034", // DPT3 immunization coverage
  "WHS4_544", // Child malnutrition
  "WHS9_86", // Exclusive breastfeeding
];

// Puppeteer launch arguments for web scraping
export const PUPPETEER_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
  "--disable-web-security",
  "--disable-features=VizDisplayCompositor",
  "--disable-blink-features=AutomationControlled",
  "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
];
