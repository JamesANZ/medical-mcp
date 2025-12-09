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
