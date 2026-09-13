import { anzctrAdapter } from "./adapters/anzctr.js";
import { clinicalTrialsAdapter } from "./adapters/clinicaltrials.js";
import { dailyMedAdapter } from "./adapters/dailymed.js";
import { emaAdapter } from "./adapters/ema.js";
import { europePmcAdapter } from "./adapters/europe-pmc.js";
import { faersAdapter } from "./adapters/faers.js";
import { fdaAdapter } from "./adapters/fda.js";
import { healthCanadaAdapter } from "./adapters/health-canada.js";
import { recallsAdapter } from "./adapters/recalls.js";
import { shortagesAdapter } from "./adapters/shortages.js";
import { tgaAdapter } from "./adapters/tga.js";
import { tinyFishFetchAdapter } from "./adapters/tinyfish-fetch.js";
import { tinyFishSearchAdapter } from "./adapters/tinyfish-search.js";
import { listSources, registerSource } from "./registry.js";
import type { SourceAdapter } from "./types.js";

let registered = false;

export function resetDefaultSources(): void {
  registered = false;
}

export function registerDefaultSources(): void {
  if (registered) return;
  const adapters: SourceAdapter<unknown>[] = [
    fdaAdapter,
    dailyMedAdapter,
    tgaAdapter,
    healthCanadaAdapter,
    emaAdapter,
    faersAdapter,
    recallsAdapter,
    shortagesAdapter,
    clinicalTrialsAdapter,
    anzctrAdapter,
    europePmcAdapter,
    tinyFishSearchAdapter,
    tinyFishFetchAdapter,
  ];
  for (const adapter of adapters) {
    registerSource(adapter);
  }
  registered = true;
}

export function catalogSources() {
  registerDefaultSources();
  return listSources().map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    country: adapter.country,
    domain: adapter.domain,
    access: adapter.access,
    requiresKey: adapter.requiresKey,
  }));
}
