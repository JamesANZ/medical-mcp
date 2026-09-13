import { logger } from "../../logger.js";
import { timedHealthCheck } from "../http.js";
import type { ClinicalTrial, SearchOpts, SourceAdapter } from "../types.js";
import { searchClinicalTrialsApi } from "./clinicaltrials.js";

/**
 * ANZCTR's public SOAP/HTTP web service now returns "User Unauthorised"
 * without partner credentials. Fall back to ClinicalTrials.gov location
 * filters for Australia and New Zealand.
 */
async function searchAnzctr(
  query: string,
  opts: SearchOpts = {},
): Promise<ClinicalTrial[]> {
  const limit = opts.limit ?? 10;
  const [au, nz] = await Promise.all([
    searchClinicalTrialsApi(query, {
      limit,
      extra: { location: "Australia" },
    }),
    searchClinicalTrialsApi(query, {
      limit,
      extra: { location: "New Zealand" },
    }),
  ]);

  const seen = new Set<string>();
  const merged: ClinicalTrial[] = [];
  for (const trial of [...au, ...nz]) {
    const key = trial.id || trial.title;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...trial,
      source: "ANZCTR via ClinicalTrials.gov",
      country: trial.country === "New Zealand" ? "NZ" : "AU",
    });
    if (merged.length >= limit) break;
  }
  logger.info("ANZCTR", `Returning ${merged.length} AU/NZ trials via CT.gov`);
  return merged;
}

export const anzctrAdapter: SourceAdapter<ClinicalTrial> = {
  id: "anzctr",
  name: "ANZCTR",
  country: "AU",
  domain: "trials",
  access: "rest",
  requiresKey: false,
  search: searchAnzctr,
  healthCheck: () =>
    timedHealthCheck(async () => {
      const rows = await searchClinicalTrialsApi("health", {
        limit: 1,
        extra: { location: "Australia" },
      });
      if (rows.length === 0) {
        throw new Error("No Australia-located trials returned");
      }
    }),
};
