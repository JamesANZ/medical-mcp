/**
 * Resilience Layer — composes circuit breaker + retry + rate limiter
 *
 * Usage:
 *   const data = await resilientCall("PubMed", () => superagent.get(url).query(q));
 */

export {
  CircuitBreaker,
  CircuitOpenError,
  CircuitState,
  getCircuitBreaker,
  getAllCircuitStatus,
} from "./circuit-breaker.js";
export { withRetry, type RetryOptions } from "./retry.js";
export {
  withRateLimit,
  getRateLimiter,
  getAllRateLimiterStatus,
} from "./rate-limiter.js";

import { getCircuitBreaker } from "./circuit-breaker.js";
import { withRetry, type RetryOptions } from "./retry.js";
import { withRateLimit } from "./rate-limiter.js";
import { logger } from "../logger.js";

export interface ResilientCallOptions {
  /** Override retry settings */
  retry?: Partial<RetryOptions>;
  /** Skip rate limiting (e.g. for cached calls) */
  skipRateLimit?: boolean;
}

/**
 * Execute an API call with the full resilience stack:
 *   1. Rate limit (wait for token)
 *   2. Circuit breaker (reject if source is down)
 *   3. Retry with exponential backoff (on transient failures)
 */
export async function resilientCall<T>(
  source: string,
  fn: () => Promise<T>,
  options?: ResilientCallOptions,
): Promise<T> {
  const timer = logger.startTimer(source, "API call");

  try {
    // 1. Rate limit
    if (!options?.skipRateLimit) {
      await withRateLimit(source, async () => {});
    }

    // 2. Circuit breaker wraps retry
    const breaker = getCircuitBreaker(source);
    const result = await breaker.execute(() =>
      // 3. Retry inside the circuit breaker
      withRetry(fn, {
        source,
        ...options?.retry,
      }),
    );

    timer.stop({
      resultCount: Array.isArray(result) ? result.length : undefined,
    });
    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error(source, `Resilient call failed: ${errMsg}`);
    throw error;
  }
}
