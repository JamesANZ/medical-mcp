// Cache configuration with TTL policies and environment variable support

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  cleanupInterval: number;
  ttls: {
    fda: number;
    pubmed: number;
    who: number;
    rxnorm: number;
    clinicalGuidelines: number;
    googleScholar: number;
    brightFutures: number;
    aapPolicy: number;
    pediatricJournals: number;
    childHealth: number;
    pediatricDrugs: number;
  };
}

// Default TTL values (in seconds)
const DEFAULT_TTL_FDA = 86400; // 24 hours
const DEFAULT_TTL_PUBMED = 3600; // 1 hour
const DEFAULT_TTL_WHO = 604800; // 7 days
const DEFAULT_TTL_RXNORM = 2592000; // 30 days
const DEFAULT_TTL_CLINICAL_GUIDELINES = 604800; // 7 days
const DEFAULT_TTL_GOOGLE_SCHOLAR = 3600; // 1 hour
const DEFAULT_TTL_BRIGHT_FUTURES = 2592000; // 30 days (guidelines change infrequently)
const DEFAULT_TTL_AAP_POLICY = 604800; // 7 days
const DEFAULT_TTL_PEDIATRIC_JOURNALS = 3600; // 1 hour (same as PubMed)
const DEFAULT_TTL_CHILD_HEALTH = 604800; // 7 days (same as WHO)
const DEFAULT_TTL_PEDIATRIC_DRUGS = 86400; // 24 hours (same as FDA)

// Default configuration values
const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_CLEANUP_INTERVAL = 300000; // 5 minutes in milliseconds

export function getCacheConfig(): CacheConfig {
  return {
    enabled: process.env.CACHE_ENABLED !== "false", // Default to true
    maxSize: parseInt(
      process.env.CACHE_MAX_SIZE || String(DEFAULT_MAX_SIZE),
      10,
    ),
    cleanupInterval: parseInt(
      process.env.CACHE_CLEANUP_INTERVAL || String(DEFAULT_CLEANUP_INTERVAL),
      10,
    ),
    ttls: {
      fda: parseInt(process.env.CACHE_TTL_FDA || String(DEFAULT_TTL_FDA), 10),
      pubmed: parseInt(
        process.env.CACHE_TTL_PUBMED || String(DEFAULT_TTL_PUBMED),
        10,
      ),
      who: parseInt(process.env.CACHE_TTL_WHO || String(DEFAULT_TTL_WHO), 10),
      rxnorm: parseInt(
        process.env.CACHE_TTL_RXNORM || String(DEFAULT_TTL_RXNORM),
        10,
      ),
      clinicalGuidelines: parseInt(
        process.env.CACHE_TTL_CLINICAL_GUIDELINES ||
          String(DEFAULT_TTL_CLINICAL_GUIDELINES),
        10,
      ),
      googleScholar: parseInt(
        process.env.CACHE_TTL_GOOGLE_SCHOLAR ||
          String(DEFAULT_TTL_GOOGLE_SCHOLAR),
        10,
      ),
      brightFutures: parseInt(
        process.env.CACHE_TTL_BRIGHT_FUTURES ||
          String(DEFAULT_TTL_BRIGHT_FUTURES),
        10,
      ),
      aapPolicy: parseInt(
        process.env.CACHE_TTL_AAP_POLICY || String(DEFAULT_TTL_AAP_POLICY),
        10,
      ),
      pediatricJournals: parseInt(
        process.env.CACHE_TTL_PEDIATRIC_JOURNALS ||
          String(DEFAULT_TTL_PEDIATRIC_JOURNALS),
        10,
      ),
      childHealth: parseInt(
        process.env.CACHE_TTL_CHILD_HEALTH || String(DEFAULT_TTL_CHILD_HEALTH),
        10,
      ),
      pediatricDrugs: parseInt(
        process.env.CACHE_TTL_PEDIATRIC_DRUGS ||
          String(DEFAULT_TTL_PEDIATRIC_DRUGS),
        10,
      ),
    },
  };
}
