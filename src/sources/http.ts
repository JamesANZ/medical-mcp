import type { SourceHealth } from "./types.js";

export async function timedHealthCheck(
  fn: () => Promise<void>,
): Promise<SourceHealth> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function skippedHealth(reason: string): SourceHealth {
  return { ok: true, latencyMs: 0, skipped: true, error: reason };
}
