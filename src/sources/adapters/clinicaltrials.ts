import superagent from "superagent";
import { CLINICALTRIALS_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { ClinicalTrialsResponseSchema, safeValidate } from "../../validation/schemas.js";
import { timedHealthCheck } from "../http.js";
import type { ClinicalTrial, SearchOpts, SourceAdapter } from "../types.js";

type Study = {
  protocolSection?: {
    identificationModule?: {
      briefTitle?: string;
      officialTitle?: string;
      nctId?: string;
      leadSponsor?: { name?: string };
      briefSummary?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
    };
    contactsLocationsModule?: {
      locations?: Array<{ country?: string }>;
    };
  };
};

export function mapClinicalTrial(study: Study): ClinicalTrial {
  const id = study.protocolSection?.identificationModule;
  const status = study.protocolSection?.statusModule;
  const countries = (
    study.protocolSection?.contactsLocationsModule?.locations || []
  )
    .map((location) => location.country)
    .filter((country): country is string => Boolean(country));
  return {
    source: "ClinicalTrials.gov",
    country: countries[0] || "INTL",
    title: id?.briefTitle || id?.officialTitle || "Clinical trial",
    id: id?.nctId,
    status: status?.overallStatus,
    sponsor: id?.leadSponsor?.name,
    summary: id?.briefSummary,
    startDate: status?.startDateStruct?.date,
    url: id?.nctId
      ? `https://clinicaltrials.gov/study/${id.nctId}`
      : "https://clinicaltrials.gov/",
  };
}

export async function searchClinicalTrialsApi(
  query: string,
  opts: SearchOpts = {},
): Promise<ClinicalTrial[]> {
  const limit = opts.limit ?? 10;
  const params: Record<string, string | number> = {
    "query.term": query,
    format: "json",
    pageSize: limit,
  };
  if (opts.extra?.location) {
    params["query.locn"] = String(opts.extra.location);
  }
  try {
    const res = await resilientCall("ClinicalTrials", async () =>
      superagent
        .get(CLINICALTRIALS_API_BASE)
        .query(params)
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );
    const validated = safeValidate(
      ClinicalTrialsResponseSchema,
      res.body,
      "ClinicalTrials",
    );
    return (validated.studies || []).map((study) =>
      mapClinicalTrial(study as Study),
    );
  } catch (error) {
    logger.warn(
      "ClinicalTrials",
      `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export const clinicalTrialsAdapter: SourceAdapter<ClinicalTrial> = {
  id: "clinicaltrials",
  name: "ClinicalTrials.gov",
  country: "INTL",
  domain: "trials",
  access: "rest",
  requiresKey: false,
  search: searchClinicalTrialsApi,
  healthCheck: () =>
    timedHealthCheck(async () => {
      await superagent
        .get(CLINICALTRIALS_API_BASE)
        .query({ "query.term": "health", format: "json", pageSize: 1 })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 10_000, deadline: 15_000 });
    }),
};
