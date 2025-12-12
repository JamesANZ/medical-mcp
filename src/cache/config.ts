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
  };
}

// Default TTL values (in seconds)
const DEFAULT_TTL_FDA = 86400; // 24 hours
const DEFAULT_TTL_PUBMED = 3600; // 1 hour
const DEFAULT_TTL_WHO = 604800; // 7 days
const DEFAULT_TTL_RXNORM = 2592000; // 30 days
const DEFAULT_TTL_CLINICAL_GUIDELINES = 604800; // 7 days
const DEFAULT_TTL_GOOGLE_SCHOLAR = 3600; // 1 hour

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
    },
  };
}
