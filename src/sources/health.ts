import { registerDefaultSources } from "./register.js";
import { listSources } from "./registry.js";

export async function getRegisteredSourceHealth() {
  registerDefaultSources();
  const adapters = listSources();
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const health = await adapter.healthCheck();
      return {
        source: adapter.name,
        status: health.skipped
          ? ("degraded" as const)
          : health.ok
            ? ("healthy" as const)
            : health.latencyMs > 8_000
              ? ("degraded" as const)
              : ("down" as const),
        latencyMs: health.latencyMs,
        error: health.error,
      };
    }),
  );
  return results;
}
