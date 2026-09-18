import {
  DEFAULT_DRUG_COUNTRIES,
  SUPPORTED_DRUG_COUNTRIES,
} from "../constants.js";
import { getCacheConfig } from "../cache/config.js";
import { cachedCall } from "./cached.js";
import { fanoutSearch } from "./fanout.js";
import { registerDefaultSources } from "./register.js";
import { listSources } from "./registry.js";
import type { RegulatoryProduct, SourceAdapter } from "./types.js";

function normalizeCountries(countries?: string[]): string[] {
  if (!countries || countries.length === 0) {
    return [...DEFAULT_DRUG_COUNTRIES];
  }
  const selected = countries.map((country) => country.toUpperCase());
  const unsupported = selected.filter(
    (code) => !(SUPPORTED_DRUG_COUNTRIES as readonly string[]).includes(code),
  );
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported country code(s): ${unsupported.join(", ")}. Supported codes: ${SUPPORTED_DRUG_COUNTRIES.join(", ")}.`,
    );
  }
  return selected;
}

export async function searchInternationalDrugs(
  query: string,
  limit = 10,
  countries?: string[],
) {
  registerDefaultSources();
  const selected = normalizeCountries(countries);
  const adapters = listSources({
    domain: "regulator",
    countries: selected,
  }) as SourceAdapter<RegulatoryProduct>[];

  const ttl = getCacheConfig().ttls.regulators;
  return cachedCall(
    "Regulators",
    "search-drugs",
    { query, limit, countries: selected },
    ttl,
    () => fanoutSearch(adapters, query, { limit }),
  );
}
