export const FDA_API_BASE = "https://api.fda.gov";
export const WHO_API_BASE = "https://ghoapi.azureedge.net/api";
export const RXNAV_API_BASE = "https://rxnav.nlm.nih.gov/REST";
export const PUBMED_API_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
export const GOOGLE_SCHOLAR_API_BASE = "https://scholar.google.com/scholar";
export const PBS_API_BASE = "https://data-api.health.gov.au/pbs/api/v3";
export const USER_AGENT = "medical-mcp/1.0";

// PBS API Configuration
export const PBS_API_KEY =
  process.env.PBS_API_KEY ||
  process.env.PBS_SUBSCRIPTION_KEY ||
  "2384af7c667342ceb5a736fe29f1dc6b"; // Public subscription key for unregistered users
export const PBS_REQUIRES_AUTH = false; // PBS public API can work with the public subscription key
