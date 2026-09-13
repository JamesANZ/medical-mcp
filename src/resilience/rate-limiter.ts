/**
 * Token Bucket Rate Limiter
 *
 * Prevents exceeding upstream API rate limits.
 * Each source gets its own bucket with configurable rate.
 */

import { logger } from "../logger.js";

export interface RateLimiterOptions {
  /** Max tokens in the bucket */
  maxTokens: number;
  /** Tokens added per second (refill rate) */
  refillRate: number;
  /** Source name for logging */
  name: string;
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
    this.tokens = options.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const newTokens = elapsed * this.options.refillRate;
    this.tokens = Math.min(this.options.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate limited.
   */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   */
  async waitForToken(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time for next token
    const tokensNeeded = 1 - this.tokens;
    const waitMs = (tokensNeeded / this.options.refillRate) * 1000;

    logger.debug(
      this.options.name,
      `Rate limited — waiting ${Math.ceil(waitMs)}ms for token`,
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  getStatus() {
    this.refill();
    return {
      name: this.options.name,
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.options.maxTokens,
      refillRate: this.options.refillRate,
    };
  }
}

// ────────────────────────────────────────────
// Default rate limits per source
// ────────────────────────────────────────────

/**
 * PubMed: 3/sec without API key, 10/sec with key
 * FDA: 240/min ≈ 4/sec
 * WHO: no documented limit, be conservative
 * RxNorm: no documented limit, be conservative
 * Google Scholar: very restrictive, ~1/5sec
 * Semantic Scholar: 100/sec (generous)
 */
const SOURCE_LIMITS: Record<string, RateLimiterOptions> = {
  PubMed: {
    name: "PubMed",
    maxTokens: process.env.NCBI_API_KEY ? 10 : 3,
    refillRate: process.env.NCBI_API_KEY ? 10 : 3,
  },
  FDA: { name: "FDA", maxTokens: 4, refillRate: 4 },
  WHO: { name: "WHO", maxTokens: 5, refillRate: 5 },
  RxNorm: { name: "RxNorm", maxTokens: 5, refillRate: 5 },
  GoogleScholar: { name: "GoogleScholar", maxTokens: 1, refillRate: 0.2 },
  SemanticScholar: { name: "SemanticScholar", maxTokens: 10, refillRate: 10 },
  Cochrane: { name: "Cochrane", maxTokens: 1, refillRate: 0.5 },
  ClinicalTrials: { name: "ClinicalTrials", maxTokens: 3, refillRate: 3 },
  TGA: { name: "TGA", maxTokens: 2, refillRate: 2 },
  HealthCanada: { name: "HealthCanada", maxTokens: 3, refillRate: 3 },
  EMA: { name: "EMA", maxTokens: 1, refillRate: 0.1 },
  DailyMed: { name: "DailyMed", maxTokens: 3, refillRate: 3 },
  FAERS: { name: "FAERS", maxTokens: 4, refillRate: 4 },
  FDARecalls: { name: "FDARecalls", maxTokens: 4, refillRate: 4 },
  FDAShortages: { name: "FDAShortages", maxTokens: 4, refillRate: 4 },
  EuropePMC: { name: "EuropePMC", maxTokens: 5, refillRate: 5 },
  TinyFish: { name: "TinyFish", maxTokens: 5, refillRate: 5 },
  TinyFishFetch: { name: "TinyFishFetch", maxTokens: 3, refillRate: 3 },
};

const buckets = new Map<string, TokenBucket>();

export function getRateLimiter(source: string): TokenBucket {
  if (!buckets.has(source)) {
    const options = SOURCE_LIMITS[source] || {
      name: source,
      maxTokens: 5,
      refillRate: 5,
    };
    buckets.set(source, new TokenBucket(options));
  }
  return buckets.get(source)!;
}

/**
 * Wrap an async function with rate limiting.
 * Waits for a token before executing.
 */
export async function withRateLimit<T>(
  source: string,
  fn: () => Promise<T>,
): Promise<T> {
  const limiter = getRateLimiter(source);
  await limiter.waitForToken();
  return fn();
}

/** Get status of all rate limiters */
export function getAllRateLimiterStatus() {
  return Array.from(buckets.values()).map((b) => b.getStatus());
}
