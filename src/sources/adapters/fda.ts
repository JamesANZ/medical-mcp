import superagent from "superagent";
import { FDA_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import {
  FDASearchResponseSchema,
  safeValidate,
} from "../../validation/schemas.js";
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

type FdaApplication = {
  application_number?: string;
  sponsor_name?: string;
  products?: Array<{
    brand_name?: string;
    dosage_form?: string;
    route?: string;
    marketing_status?: string;
  }>;
  openfda?: FdaResult["openfda"];
};

const REPACKAGER =
  /medication solutions|preferred pharmaceuticals|bryant ranch|proficient rx|american health packaging|dispensing solutions|a-s medication/i;

export function mapFdaApplication(app: FdaApplication): RegulatoryProduct[] {
  const products = app.products || [];
  const seen = new Set<string>();
  const rows: RegulatoryProduct[] = [];
  const applicationNo = (app.application_number || "").replace(/\D/g, "");
  for (const product of products.length > 0 ? products : [{}]) {
    const brand =
      product.brand_name ||
      app.openfda?.brand_name?.[0] ||
      app.openfda?.generic_name?.[0];
    if (!brand) continue;
    const key = brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      source: "FDA",
      country: "US",
      productName: brand,
      activeIngredients: app.openfda?.substance_name || [],
      status: product.marketing_status || app.application_number,
      identifier: app.application_number
        ? { type: "Application", value: app.application_number }
        : undefined,
      sponsor: app.sponsor_name || app.openfda?.manufacturer_name?.[0],
      dosageForm: product.dosage_form || app.openfda?.dosage_form?.[0],
      route: product.route || app.openfda?.route?.[0],
      url: applicationNo
        ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applicationNo}`
        : undefined,
    });
  }
  return rows;
}

function rankFdaProducts(
  products: RegulatoryProduct[],
  query: string,
): RegulatoryProduct[] {
  const q = query.trim().toLowerCase();
  return [...products].sort((a, b) => {
    const exactA = a.productName.toLowerCase() === q ? 0 : 1;
    const exactB = b.productName.toLowerCase() === q ? 0 : 1;
    if (exactA !== exactB) return exactA - exactB;
    const packA = REPACKAGER.test(a.sponsor || "") ? 1 : 0;
    const packB = REPACKAGER.test(b.sponsor || "") ? 1 : 0;
    return packA - packB;
  });
}

async function searchFda(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  const searches = [
    `(openfda.brand_name:"${query}") OR (openfda.generic_name:"${query}") OR (openfda.substance_name:"${query}")`,
    `openfda.brand_name:"${query}"`,
    `openfda.generic_name:"${query}"`,
    `openfda.substance_name:"${query}"`,
  ];
  const seen = new Set<string>();
  const products: RegulatoryProduct[] = [];

  try {
    const res = await resilientCall("FDA", async () =>
      superagent
        .get(`${FDA_API_BASE}/drug/drugsfda.json`)
        .query({ search: searches[0], limit: Math.min(limit * 5, 50) })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    for (const app of res.body?.results || []) {
      for (const mapped of mapFdaApplication(app as FdaApplication)) {
        const key = `${mapped.productName}|${mapped.identifier?.value || mapped.sponsor}`;
        if (seen.has(key.toLowerCase())) continue;
        seen.add(key.toLowerCase());
        products.push(mapped);
      }
    }
    if (products.length > 0) {
      return rankFdaProducts(products, query).slice(0, limit);
    }
  } catch (error) {
    logger.warn(
      "FDA",
      `drugsfda search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  for (const search of searches.slice(1)) {
    try {
      const res = await resilientCall("FDA", async () =>
        superagent
          .get(`${FDA_API_BASE}/drug/label.json`)
          .query({ search, limit: Math.min(limit * 3, 30) })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 15_000, deadline: 30_000 }),
      );
      const validated = safeValidate(FDASearchResponseSchema, res.body, "FDA");
      for (const drug of validated.results || []) {
        const mapped = mapFdaResult(drug as FdaResult);
        const key = mapped.identifier?.value || mapped.productName;
        if (seen.has(key.toLowerCase())) continue;
        seen.add(key.toLowerCase());
        products.push(mapped);
      }
    } catch (error) {
      logger.warn(
        "FDA",
        `Search strategy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return rankFdaProducts(products, query).slice(0, limit);
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
