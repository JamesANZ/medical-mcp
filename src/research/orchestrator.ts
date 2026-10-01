import {
  classRank,
  isOutsideLookback,
  normalizeUrl,
} from "./classify.js";
import {
  defaultAgentReachDeps,
  externalProviders,
  type AgentReachDeps,
} from "./agent-reach.js";
import {
  defaultMedicalDeps,
  drugTermsIn,
  inProcessProviders,
  type MedicalDeps,
} from "./providers.js";
import { passThroughFilter, type ContentFilter } from "./sanitize.js";
import type {
  Lookback,
  ResearchHit,
  ResearchProvider,
  ResearchReport,
  ResearchWarning,
  SourceRequest,
} from "./types.js";

const LOOKBACK_SECTIONS = new Set(["studies", "web", "discussion"]);

export interface ResearchDeps {
  now?: Date;
  medical?: MedicalDeps;
  agentReach?: AgentReachDeps;
  filter?: ContentFilter;
}

export interface ResearchInput {
  query: string;
  sources?: SourceRequest[];
  lookback?: Lookback;
  limit?: number;
}

function cleanQuery(query: string): string {
  return query
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function dedupeHits(hits: ResearchHit[]): ResearchHit[] {
  const byUrl = new Map<string, ResearchHit>();
  const withoutUrl: ResearchHit[] = [];
  const titleKeys = new Set<string>();

  for (const hit of hits) {
    const url = normalizeUrl(hit.url);
    if (url) {
      const existing = byUrl.get(url);
      if (!existing || classRank(hit.sourceClass) > classRank(existing.sourceClass)) {
        byUrl.set(url, hit);
      }
      continue;
    }
    const titleKey = `${hit.source}::${hit.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    if (titleKeys.has(titleKey)) continue;
    titleKeys.add(titleKey);
    withoutUrl.push(hit);
  }
  return [...byUrl.values(), ...withoutUrl];
}

function applyLookback(hit: ResearchHit, lookback: Lookback, now: Date): ResearchHit | null {
  if (!LOOKBACK_SECTIONS.has(hit.section)) return hit;
  if (!hit.publishedAt) return { ...hit, dateUnknown: true };
  if (isOutsideLookback(hit.publishedAt, lookback, now)) return null;
  return hit;
}

export async function researchMedicalTopic(
  input: ResearchInput,
  deps: ResearchDeps = {},
): Promise<ResearchReport> {
  const query = cleanQuery(input.query);
  const sources = input.sources?.length
    ? input.sources
    : (["authoritative", "scientific"] as SourceRequest[]);
  const lookback = input.lookback || "all";
  const limit = input.limit ?? 5;
  const now = deps.now ?? new Date();
  const medical = deps.medical ?? defaultMedicalDeps();
  const agentReach = deps.agentReach ?? defaultAgentReachDeps();
  const filter = deps.filter ?? passThroughFilter;

  const external = externalProviders(sources, agentReach);
  const providers: ResearchProvider[] = [
    ...inProcessProviders(sources, medical),
    ...external.providers,
  ];
  const warnings: ResearchWarning[] = [...external.warnings];

  const settled = await Promise.allSettled(
    providers.map(async (provider) => ({
      id: provider.id,
      outcome: await provider.search(query, { limit, lookback, now }),
    })),
  );

  const hits: ResearchHit[] = [];
  for (const result of settled) {
    if (result.status === "rejected") {
      warnings.push({
        code: "channel_failed",
        message: result.reason instanceof Error ? result.reason.message : "A source failed",
      });
      continue;
    }
    warnings.push(...result.value.outcome.warnings);
    for (const hit of result.value.outcome.hits) {
      const kept = applyLookback(hit, lookback, now);
      if (!kept) continue;
      const passed = filter(kept);
      if (passed) hits.push(passed);
    }
  }

  if (hits.some((hit) => hit.excerptTruncated) && !warnings.some((warning) => warning.code === "excerpt_truncated")) {
    warnings.push({
      code: "excerpt_truncated",
      message: "At least one excerpt was cut to 500 characters.",
    });
  }

  warnings.push(
    {
      code: "social_not_clinical_evidence",
      message: "Reddit, YouTube, X, and unclassified web pages are not clinical evidence.",
    },
    {
      code: "sections_not_reconciled",
      message: "Sections are listed separately and are not reconciled into one conclusion.",
    },
    {
      code: "not_evidence_of_absence",
      message: "An empty section means this search returned nothing, not that the effect is absent.",
    },
  );

  return {
    query,
    lookback,
    sources,
    drugTerms: drugTermsIn(query),
    hits: dedupeHits(hits),
    warnings,
  };
}
