import superagent from "superagent";
import { EMA_MEDICINES_JSON_URL, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { RegulatoryProduct, SearchOpts, SourceAdapter } from "../types.js";

type EmaMedicine = {
  name_of_medicine?: string;
  international_non_proprietary_name_common_name?: string;
  active_substance?: string;
  medicine_status?: string;
  ema_product_number?: string;
  therapeutic_area_mesh?: string;
  medicine_url?: string;
};

type EmaFile = {
  meta?: { timestamp?: string; total_records?: number };
  data?: EmaMedicine[];
};

let emaCache: { fetchedAt: number; medicines: EmaMedicine[] } | null = null;
const EMA_TTL_MS = 12 * 60 * 60 * 1000;

export function mapEmaMedicine(row: EmaMedicine): RegulatoryProduct {
  const substances = (row.active_substance || "")
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const productNumber = row.ema_product_number;
  return {
    source: "EMA",
    country: "EU",
    productName: row.name_of_medicine || "Unknown medicine",
    activeIngredients:
      substances.length > 0
        ? substances
        : [row.international_non_proprietary_name_common_name || ""].filter(
            Boolean,
          ),
    status: row.medicine_status,
    identifier: productNumber
      ? { type: "EMA number", value: productNumber }
      : undefined,
    url:
      row.medicine_url ||
      (row.name_of_medicine
        ? `https://www.ema.europa.eu/en/medicines/human/EPAR/${encodeURIComponent(
            row.name_of_medicine.toLowerCase().replace(/\s+/g, "-"),
          )}`
        : "https://www.ema.europa.eu/en/medicines"),
  };
}

export function filterEmaMedicines(
  medicines: EmaMedicine[],
  query: string,
  limit: number,
): EmaMedicine[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return medicines
    .filter((row) => {
      const haystack = [
        row.name_of_medicine,
        row.international_non_proprietary_name_common_name,
        row.active_substance,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    })
    .slice(0, limit);
}

async function loadEmaMedicines(): Promise<EmaMedicine[]> {
  if (emaCache && Date.now() - emaCache.fetchedAt < EMA_TTL_MS) {
    return emaCache.medicines;
  }

  const res = await resilientCall("EMA", async () =>
    superagent
      .get(EMA_MEDICINES_JSON_URL)
      .set("User-Agent", USER_AGENT)
      .timeout({ response: 20_000, deadline: 45_000 }),
  );
  const body = res.body as EmaFile;
  const medicines = Array.isArray(body?.data) ? body.data : [];
  emaCache = { fetchedAt: Date.now(), medicines };
  logger.info("EMA", `Loaded ${medicines.length} medicines from EMA JSON`);
  return medicines;
}

export function resetEmaCache(): void {
  emaCache = null;
}

async function searchEma(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  try {
    const medicines = await loadEmaMedicines();
    return filterEmaMedicines(medicines, query, limit).map(mapEmaMedicine);
  } catch (error) {
    logger.warn(
      "EMA",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const emaAdapter: SourceAdapter<RegulatoryProduct> = {
  id: "ema",
  name: "EMA",
  country: "EU",
  domain: "regulator",
  access: "bulk-json",
  requiresKey: false,
  search: searchEma,
  healthCheck: () =>
    timedHealthCheck(async () => {
      if (emaCache) return;
      await superagent
        .get(EMA_MEDICINES_JSON_URL)
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 20_000 });
    }),
};
