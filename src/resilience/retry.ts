/**
 * Retry with Exponential Backoff + Jitter
 *
 * Wraps an async function with configurable retry logic.
 * Uses full-jitter strategy to avoid thundering herd.
 */

import { logger } from "../logger.js";
import { CircuitOpenError } from "./circuit-breaker.js";

export interface RetryOptions {
  /** Maximum number of retry attempts (0 = no retries, just the initial call) */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
  /** Which HTTP status codes are retryable */
  retryableStatusCodes: number[];
  /** Source name for logging */
  source: string;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  source: "unknown",
};

/**
 * Calculate delay with full jitter:
 *   delay = random(0, min(maxDelay, baseDelay * 2^attempt))
 */
function calculateDelay(attempt: number, opts: RetryOptions): number {
  const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
  // Full jitter
  return Math.random() * cappedDelay;
}

function isRetryableError(error: unknown, opts: RetryOptions): boolean {
  // Never retry circuit-open errors
  if (error instanceof CircuitOpenError) return false;

  if (error instanceof Error) {
    // Superagent attaches .status to errors
    const status = (error as any).status;
    if (status && opts.retryableStatusCodes.includes(status)) {
      return true;
    }

    // Network errors
    const message = error.message.toLowerCase();
    if (
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("socket hang up") ||
      message.includes("network") ||
      message.includes("timeout")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not retryable or we're out of attempts
      if (!isRetryableError(error, opts) || attempt === opts.maxRetries) {
        throw error;
      }

      const delay = calculateDelay(attempt, opts);
      const errMsg = error instanceof Error ? error.message : String(error);
      const status = (error as any)?.status;

      logger.warn(
        opts.source,
        `Attempt ${attempt + 1}/${opts.maxRetries + 1} failed${status ? ` (HTTP ${status})` : ""}: ${errMsg}. Retrying in ${Math.round(delay)}ms`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
