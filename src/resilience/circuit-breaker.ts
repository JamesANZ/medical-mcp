/**
 * Circuit Breaker Pattern
 *
 * Prevents repeated calls to a failing upstream source.
 * States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (testing recovery)
 */

import { logger } from "../logger.js";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** How long the circuit stays open before moving to half-open (ms) */
  resetTimeoutMs: number;
  /** How many successes in half-open state to close the circuit */
  halfOpenSuccessThreshold: number;
  /** Name of the source for logging */
  name: string;
}

const DEFAULT_OPTIONS: Omit<CircuitBreakerOptions, "name"> = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000, // 1 minute
  halfOpenSuccessThreshold: 1,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get currentState(): CircuitState {
    // Check if open circuit should transition to half-open
    if (
      this.state === CircuitState.OPEN &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs
    ) {
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info(
        this.options.name,
        `Circuit breaker moved to HALF_OPEN after ${this.options.resetTimeoutMs}ms cooldown`,
      );
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   * If the circuit is open, throws immediately without calling the function.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.currentState;

    if (state === CircuitState.OPEN) {
      const remainingMs =
        this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime);
      logger.warn(
        this.options.name,
        `Circuit is OPEN — rejecting request (${Math.ceil(remainingMs / 1000)}s until retry)`,
      );
      throw new CircuitOpenError(
        this.options.name,
        Math.ceil(remainingMs / 1000),
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(
          this.options.name,
          "Circuit breaker CLOSED — source recovered",
        );
      }
    } else {
      // In CLOSED state, reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(error: unknown) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const errMsg = error instanceof Error ? error.message : String(error);

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open goes back to open
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      logger.warn(
        this.options.name,
        `Circuit breaker re-OPENED after half-open failure: ${errMsg}`,
      );
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.error(
        this.options.name,
        `Circuit breaker OPENED after ${this.failureCount} consecutive failures: ${errMsg}`,
      );
    } else {
      logger.warn(
        this.options.name,
        `Failure ${this.failureCount}/${this.options.failureThreshold}: ${errMsg}`,
      );
    }
  }

  /** Reset the circuit breaker to closed state */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  /** Get circuit breaker status for health checks */
  getStatus() {
    return {
      name: this.options.name,
      state: this.currentState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    };
  }
}

export class CircuitOpenError extends Error {
  public readonly sourceName: string;
  public readonly retryAfterSeconds: number;

  constructor(sourceName: string, retryAfterSeconds: number) {
    super(
      `${sourceName} is temporarily unavailable (circuit open). Retry in ${retryAfterSeconds}s.`,
    );
    this.name = "CircuitOpenError";
    this.sourceName = sourceName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ─────────────────────────────────────────────────
// Singleton registry of circuit breakers per source
// ─────────────────────────────────────────────────

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>,
): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker({ name, ...options }));
  }
  return breakers.get(name)!;
}

/** Get health status for all circuit breakers */
export function getAllCircuitStatus() {
  return Array.from(breakers.values()).map((b) => b.getStatus());
}
