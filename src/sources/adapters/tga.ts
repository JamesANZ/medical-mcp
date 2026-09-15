import superagent from "superagent";
import { TGA_ARTG_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { RegulatoryProduct, SearchOpts, SourceAdapter } from "../types.js";

type TgaIngredient = {
  Name?: string;
  FormulationType?: string;
};

type TgaResult = {
  Name?: string;
  LicenceId?: string;
  Status?: string;
  ProductCategory?: string;
  EntryType?: string;
  Sponsor?: { Name?: string };
  Products?: Array<{
    Ingredients?: TgaIngredient[];
    Components?: Array<{
      DosageForm?: string;
      RouteOfAdministration?: string;
    }>;
  }>;
};

export function mapTgaResult(entry: TgaResult): RegulatoryProduct {
  const ingredients = (entry.Products || [])
    .flatMap((product) => product.Ingredients || [])
    .filter((ingredient) =>
      (ingredient.FormulationType || "").toLowerCase().includes("active"),
    )
    .map((ingredient) => ingredient.Name?.trim())
    .filter((name): name is string => Boolean(name));

  const component = entry.Products?.[0]?.Components?.[0];
  const artgId = entry.LicenceId;

  return {
    source: "TGA ARTG",
    country: "AU",
    productName: entry.Name || "Unknown ARTG entry",
    activeIngredients: [...new Set(ingredients)],
    status: entry.Status,
    identifier: artgId ? { type: "ARTG ID", value: artgId } : undefined,
    sponsor: entry.Sponsor?.Name,
    dosageForm: component?.DosageForm,
    route: component?.RouteOfAdministration,
    url: artgId
      ? `https://www.tga.gov.au/resources/artg/${encodeURIComponent(artgId)}`
      : "https://www.tga.gov.au/resources/artg",
  };
}

async function searchTgaBy(
  field: "name" | "ingredient",
  value: string,
  limit: number,
) {
  const res = await resilientCall("TGA", async () =>
    superagent
      .get(`${TGA_ARTG_API_BASE}/ARTGValueSearch/`)
      .query({
        [field]: value,
        pagestart: 1,
        pageend: Math.max(limit, 1),
      })
      .set("User-Agent", USER_AGENT)
      .timeout({ response: 15_000, deadline: 30_000 }),
  );
  return (res.body?.Results || []) as TgaResult[];
}

async function searchTga(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  try {
    let results = await searchTgaBy("name", query, limit);
    if (results.length === 0) {
      results = await searchTgaBy("ingredient", query, limit);
    }
    return results.slice(0, limit).map(mapTgaResult);
  } catch (error) {
    logger.warn(
      "TGA",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const tgaAdapter: SourceAdapter<RegulatoryProduct> = {
  id: "tga-artg",
  name: "TGA ARTG",
  country: "AU",
  domain: "regulator",
  access: "rest",
  requiresKey: false,
  search: searchTga,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${TGA_ARTG_API_BASE}/ARTGValueSearch/`)
        .query({ name: "paracetamol", pagestart: 1, pageend: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
