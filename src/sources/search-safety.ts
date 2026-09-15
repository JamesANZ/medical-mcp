import { getCacheConfig } from "../cache/config.js";
import { cachedCall } from "./cached.js";
import { fanoutSearch } from "./fanout.js";
import { dedupeSafetyEvents } from "./query.js";
import { registerDefaultSources } from "./register.js";
import { listSources } from "./registry.js";
import type { SafetyEvent, SourceAdapter } from "./types.js";

export async function searchDrugSafety(query: string, limit = 10) {
  registerDefaultSources();
  const adapters = listSources({
    domain: "safety",
  }) as SourceAdapter<SafetyEvent>[];
  const ttl = getCacheConfig().ttls.safety;
  return cachedCall(
    "Safety",
    "search-drug-safety",
    { query, limit },
    ttl,
    async () => {
      const result = await fanoutSearch(adapters, query, { limit });
      return { ...result, items: dedupeSafetyEvents(result.items) };
    },
  );
}
