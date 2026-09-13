import superagent from "superagent";
import { DAILYMED_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { timedHealthCheck } from "../http.js";
import type { RegulatoryProduct, SearchOpts, SourceAdapter } from "../types.js";

type DailyMedSpl = {
  title?: string;
  setid?: string;
  published_date?: string;
};

export function mapDailyMedSpl(spl: DailyMedSpl): RegulatoryProduct {
  const title = spl.title || "Unknown SPL";
  const match = title.match(/\(([^)]+)\)/);
  return {
    source: "DailyMed",
    country: "US",
    productName: title,
    activeIngredients: match ? [match[1]] : [],
    status: spl.published_date ? `Published ${spl.published_date}` : undefined,
    identifier: spl.setid ? { type: "SETID", value: spl.setid } : undefined,
    url: spl.setid
      ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(spl.setid)}`
      : "https://dailymed.nlm.nih.gov/",
  };
}

async function searchDailyMed(
  query: string,
  opts: SearchOpts = {},
): Promise<RegulatoryProduct[]> {
  const limit = opts.limit ?? 10;
  try {
    const res = await resilientCall("DailyMed", async () =>
      superagent
        .get(`${DAILYMED_API_BASE}/spls.json`)
        .query({ drug_name: query, pagesize: limit })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const rows = (res.body?.data || []) as DailyMedSpl[];
    return rows.slice(0, limit).map(mapDailyMedSpl);
  } catch (error) {
    logger.warn(
      "DailyMed",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const dailyMedAdapter: SourceAdapter<RegulatoryProduct> = {
  id: "dailymed",
  name: "DailyMed",
  country: "US",
  domain: "regulator",
  access: "rest",
  requiresKey: false,
  search: searchDailyMed,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(`${DAILYMED_API_BASE}/spls.json`)
        .query({ drug_name: "aspirin", pagesize: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
