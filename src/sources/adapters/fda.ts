import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { FDASearchResponseSchema, safeValidate } from "../../validation/schemas.js";
import { timedHealthCheck } from "../http.js";
import type { RegulatoryProduct, SearchOpts, SourceAdapter } from "../types.js";

type FdaResult = {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_ndc?: string[];
    substance_name?: string[];
    route?: string[];
    dosage_form?: string[];
  };
  effective_time?: string;
};

export function mapFdaResult(drug: FdaResult): RegulatoryProduct {
  const brand = drug.openfda?.brand_name?.[0];
  const generic = drug.openfda?.generic_name?.[0];
  const ndc = drug.openfda?.product_ndc?.[0];
  return {
    source: "FDA",
    country: "US",
    productName: brand || generic || "Unknown product",
    activeIngredients: drug.openfda?.substance_name || [],
    status: drug.effective_time ? `Label ${drug.effective_time}` : undefined,
    identifier: ndc ? { type: "NDC", value: ndc } : undefined,
    sponsor: drug.openfda?.manufacturer_name?.[0],
    dosageForm: drug.openfda?.dosage_form?.[0],
    route: drug.openfda?.route?.[0],
    url: ndc
      ? `https://dailymed.nlm.nih.gov/dailymed/search.cfm?searchterm=${encodeURIComponent(ndc)}`
      : undefined,
  };
}

async function searchFda(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  const searches = [
    `openfda.brand_name:"${query}"`,
    `openfda.generic_name:"${query}"`,
    `openfda.substance_name:"${query}"`,
  ];
  const seen = new Set<string>();
  const products: RegulatoryProduct[] = [];

  for (const search of searches) {
    try {
      const res = await resilientCall("FDA", async () =>
        superagent
          .get(`${FDA_API_BASE}/drug/label.json`)
          .query({ search, limit })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 15_000, deadline: 30_000 }),
      );
      const validated = safeValidate(FDASearchResponseSchema, res.body, "FDA");
      for (const drug of validated.results || []) {
        const mapped = mapFdaResult(drug as FdaResult);
        const key = mapped.identifier?.value || mapped.productName;
        if (seen.has(key)) continue;
        seen.add(key);
        products.push(mapped);
        if (products.length >= limit) return products;
      }
    } catch (error) {
      logger.warn(
        "FDA",
        `Search strategy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return products;
}

export const fdaAdapter: SourceAdapter<RegulatoryProduct> = {
  id: "fda",
  name: "FDA",
  country: "US",
  domain: "regulator",
  access: "rest",
  requiresKey: false,
  search: searchFda,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${FDA_API_BASE}/drug/label.json`)
        .query({ search: 'openfda.brand_name:"aspirin"', limit: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
