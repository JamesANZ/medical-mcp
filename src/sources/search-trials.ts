import { getCacheConfig } from "../cache/config.js";
import { cachedCall } from "./cached.js";
import { fanoutSearch } from "./fanout.js";
import { registerDefaultSources } from "./register.js";
import { listSources } from "./registry.js";
import type { ClinicalTrial, SourceAdapter } from "./types.js";

export async function searchInternationalTrials(query: string, limit = 10) {
  registerDefaultSources();
  const adapters = listSources({
    domain: "trials",
  }) as SourceAdapter<ClinicalTrial>[];
  const ttl = getCacheConfig().ttls.trials;
  return cachedCall(
    "Trials",
    "search-clinical-trials",
    { query, limit },
    ttl,
    () => fanoutSearch(adapters, query, { limit }),
  );
}
