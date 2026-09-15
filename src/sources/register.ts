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
import type { SourceAdapter, SourceCatalogRow } from "./types.js";

const DEDICATED_SOURCES: SourceCatalogRow[] = [
  {
    id: "who",
    name: "WHO GHO",
    country: "INTL",
    domain: "public_health",
    access: "rest",
    requiresKey: false,
    tools: ["get-health-statistics", "get-child-health-statistics"],
    exposed: true,
  },
  {
    id: "pubmed",
    name: "PubMed",
    country: "INTL",
    domain: "literature",
    access: "rest",
    requiresKey: true,
    tools: [
      "search-medical-literature",
      "get-article-details",
      "search-clinical-guidelines",
      "search-medical-databases",
      "search-pediatric-literature",
    ],
    exposed: true,
  },
  {
    id: "rxnorm",
    name: "RxNorm",
    country: "US",
    domain: "regulator",
    access: "rest",
    requiresKey: false,
    tools: ["search-drug-nomenclature"],
    exposed: true,
  },
  {
    id: "google-scholar",
    name: "Google Scholar",
    country: "INTL",
    domain: "literature",
    access: "scrape",
    requiresKey: false,
    tools: ["search-google-scholar", "search-medical-databases"],
    exposed: true,
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    country: "INTL",
    domain: "literature",
    access: "rest",
    requiresKey: false,
    tools: ["search-google-scholar", "search-medical-databases"],
    exposed: true,
  },
  {
    id: "cochrane",
    name: "Cochrane",
    country: "INTL",
    domain: "literature",
    access: "scrape",
    requiresKey: false,
    tools: ["search-medical-databases"],
    exposed: true,
  },
  {
    id: "aap",
    name: "AAP / Bright Futures",
    country: "US",
    domain: "guidelines",
    access: "scrape",
    requiresKey: false,
    tools: ["search-pediatric-guidelines", "search-aap-guidelines"],
    exposed: true,
  },
];

function toolsForAdapter(adapter: SourceAdapter<unknown>): {
  tools: string[];
  exposed: boolean;
} {
  switch (adapter.id) {
    case "tinyfish-fetch":
      return { tools: [], exposed: false };
    case "europe-pmc":
      return { tools: ["search-medical-databases"], exposed: true };
    case "tinyfish-search":
      return {
        tools: ["search-google-scholar", "search-medical-databases"],
        exposed: true,
      };
    case "clinicaltrials":
      return {
        tools: ["search-clinical-trials", "search-medical-databases"],
        exposed: true,
      };
    case "anzctr":
      return { tools: ["search-clinical-trials"], exposed: true };
    default:
      if (adapter.domain === "regulator") {
        return { tools: ["search-drugs"], exposed: true };
      }
      if (adapter.domain === "safety") {
        return { tools: ["search-drug-safety"], exposed: true };
      }
      if (adapter.domain === "trials") {
        return { tools: ["search-clinical-trials"], exposed: true };
      }
      return { tools: [], exposed: true };
  }
}

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

export function catalogSources(): SourceCatalogRow[] {
  registerDefaultSources();
  const registry = listSources().map((adapter) => {
    const { tools, exposed } = toolsForAdapter(adapter);
    return {
      id: adapter.id,
      name: adapter.name,
      country: adapter.country,
      domain: adapter.domain,
      access: adapter.access,
      requiresKey: adapter.requiresKey,
      tools,
      exposed,
    };
  });
  return [...registry, ...DEDICATED_SOURCES];
}
