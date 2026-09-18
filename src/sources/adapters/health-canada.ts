import superagent from "superagent";
import { HEALTH_CANADA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { RegulatoryProduct, SearchOpts, SourceAdapter } from "../types.js";

type HcProduct = {
  drug_code?: number;
  brand_name?: string;
  drug_identification_number?: string;
  company_name?: string;
  descriptor?: string;
  class_name?: string;
};

type HcIngredient = {
  drug_code?: number;
  ingredient_name?: string;
};

export function mapHealthCanadaProduct(
  product: HcProduct,
  ingredients: string[] = [],
): RegulatoryProduct {
  const din = product.drug_identification_number;
  return {
    source: "Health Canada DPD",
    country: "CA",
    productName: product.brand_name || "Unknown product",
    activeIngredients: ingredients,
    status: product.class_name ? `Class: ${product.class_name}` : undefined,
    identifier: din ? { type: "DIN", value: din } : undefined,
    sponsor: product.company_name,
    dosageForm: product.descriptor,
    url: din
      ? `https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=${encodeURIComponent(String(product.drug_code || ""))}`
      : "https://health-products.canada.ca/dpd-bdpp/",
  };
}

async function hcGet(path: string, query: Record<string, string | number>) {
  const res = await resilientCall("HealthCanada", async () =>
    superagent
      .get(`${HEALTH_CANADA_API_BASE}/${path}`)
      .query({ ...query, lang: "en", type: "json" })
      .set("User-Agent", USER_AGENT)
      .timeout({ response: 15_000, deadline: 30_000 }),
  );
  return Array.isArray(res.body) ? res.body : [];
}

async function searchHealthCanada(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  try {
    let products = (await hcGet("drugproduct/", {
      brandname: query,
    })) as HcProduct[];

    if (products.length === 0) {
      const ingredients = (await hcGet("activeingredient/", {
        ingredientname: query,
      })) as HcIngredient[];
      const codes = [
        ...new Set(
          ingredients
            .map((row) => row.drug_code)
            .filter((code): code is number => typeof code === "number"),
        ),
      ].slice(0, limit);
      const fetched = await Promise.all(
        codes.map((code) => hcGet("drugproduct/", { id: code })),
      );
      products = fetched.flat() as HcProduct[];
    }

    const selected = products.slice(0, limit);
    const mapped: RegulatoryProduct[] = [];
    for (const product of selected) {
      let names: string[] = [];
      if (product.drug_code) {
        const rows = (await hcGet("activeingredient/", {
          id: product.drug_code,
        })) as HcIngredient[];
        names = rows
          .map((row) => row.ingredient_name)
          .filter((name): name is string => Boolean(name));
      }
      mapped.push(mapHealthCanadaProduct(product, names));
    }
    return mapped;
  } catch (error) {
    logger.warn(
      "HealthCanada",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const healthCanadaAdapter: SourceAdapter<RegulatoryProduct> = {
  id: "health-canada-dpd",
  name: "Health Canada DPD",
  country: "CA",
  domain: "regulator",
  access: "rest",
  requiresKey: false,
  search: searchHealthCanada,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${HEALTH_CANADA_API_BASE}/drugproduct/`)
        .query({ brandname: "aspirin", lang: "en", type: "json" })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
