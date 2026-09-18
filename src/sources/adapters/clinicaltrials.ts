import superagent from "superagent";
import { CLINICALTRIALS_API_BASE, USER_AGENT } from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import {
  ClinicalTrialsResponseSchema,
  safeValidate,
} from "../../validation/schemas.js";
import { timedHealthCheck } from "../http.js";
import {
  analyzeTrialQuery,
  deprioritizeUnknownStatus,
  trialMatchesDrugTerms,
} from "../query.js";
import type { ClinicalTrial, SearchOpts, SourceAdapter } from "../types.js";

type Study = {
  protocolSection?: {
    identificationModule?: {
      briefTitle?: string;
      officialTitle?: string;
      acronym?: string;
      nctId?: string;
      leadSponsor?: { name?: string };
      briefSummary?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    descriptionModule?: {
      briefSummary?: string;
    };
    armsInterventionsModule?: {
      interventions?: Array<{ name?: string }>;
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
  const interventions = (
    study.protocolSection?.armsInterventionsModule?.interventions || []
  )
    .map((intervention) => intervention.name)
    .filter((name): name is string => Boolean(name));
  return {
    source: "ClinicalTrials.gov",
    country: countries[0] || "INTL",
    title: id?.briefTitle || id?.officialTitle || "Clinical trial",
    id: id?.nctId,
    status: status?.overallStatus,
    sponsor:
      study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name ||
      id?.leadSponsor?.name,
    summary:
      study.protocolSection?.descriptionModule?.briefSummary ||
      id?.briefSummary,
    startDate: status?.startDateStruct?.date,
    acronym: id?.acronym,
    interventions,
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
  const analyzed = analyzeTrialQuery(query);
  const pageSize =
    analyzed.drugTerms.length > 0
      ? Math.min(Math.max(limit * 5, 20), 50)
      : limit;
  const params: Record<string, string | number> = {
    ...analyzed.params,
    format: "json",
    pageSize,
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
    const mapped = (validated.studies || []).map((study) =>
      mapClinicalTrial(study as Study),
    );
    const matched = mapped.filter((trial) =>
      trialMatchesDrugTerms(trial, analyzed.drugTerms),
    );
    return deprioritizeUnknownStatus(matched).slice(0, limit);
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
