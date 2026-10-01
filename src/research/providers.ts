import type { DrugLabel, PubMedArticle } from "../types.js";
import { searchPubMedArticles, searchDrugs } from "../utils.js";
import {
  classifyEvidence,
  formatEvidenceTag,
} from "../utils/evidence-grading.js";
import { extractDrugTerms } from "../utils/drug-names.js";
import { searchDrugSafety, searchInternationalTrials } from "../sources/index.js";
import type { ClinicalTrial, SafetyEvent } from "../sources/types.js";
import {
  framingFor,
  lexicalOverlap,
  parseLooseDate,
} from "./classify.js";
import { sanitizeUntrusted } from "./sanitize.js";
import type {
  ProviderOutcome,
  ResearchHit,
  ResearchProvider,
  ResearchSearchOpts,
} from "./types.js";

export interface MedicalDeps {
  searchLabels(drug: string, limit: number): Promise<DrugLabel[]>;
  searchSafety(
    query: string,
    limit: number,
  ): Promise<{ items: SafetyEvent[]; errors: { source: string; message: string }[] }>;
  searchPubMed(query: string, limit: number): Promise<PubMedArticle[]>;
  searchTrials(
    query: string,
    limit: number,
  ): Promise<{ items: ClinicalTrial[]; errors: { source: string; message: string }[] }>;
}

export function defaultMedicalDeps(): MedicalDeps {
  return {
    async searchLabels(drug, limit) {
      return searchDrugs(drug, limit);
    },
    async searchSafety(query, limit) {
      const result = await searchDrugSafety(query, limit);
      return { items: result.data.items, errors: result.data.errors };
    },
    async searchPubMed(query, limit) {
      return searchPubMedArticles(query, limit);
    },
    async searchTrials(query, limit) {
      const result = await searchInternationalTrials(query, limit);
      return { items: result.data.items, errors: result.data.errors };
    },
  };
}

function hitExcerpt(query: string, title: string, body: string): {
  excerpt: string;
  excerptTruncated: boolean;
  lexicalOverlap: number;
} {
  const sanitized = sanitizeUntrusted(body);
  return {
    excerpt: sanitized.text,
    excerptTruncated: sanitized.truncated,
    lexicalOverlap: lexicalOverlap(query, `${title}\n${sanitized.text}`),
  };
}

function labelExcerpt(label: DrugLabel): string {
  const reactions = (label.adverse_reactions || []).filter(Boolean).join("\n");
  if (reactions) return reactions;
  return (label.warnings || []).filter(Boolean).join("\n");
}

export function createLabelProvider(deps: MedicalDeps): ResearchProvider {
  return {
    id: "labels",
    async search(query, opts) {
      const drugs = extractDrugTerms(query);
      if (drugs.length === 0) return { hits: [], warnings: [] };
      const hits: ResearchHit[] = [];
      const warnings: ProviderOutcome["warnings"] = [];
      try {
        for (const drug of drugs) {
          const labels = await deps.searchLabels(drug, opts.limit);
          for (const label of labels) {
            if (hits.length >= opts.limit) break;
            const body = labelExcerpt(label);
            if (!body) continue;
            const name =
              label.openfda.brand_name?.[0] ||
              label.openfda.generic_name?.[0] ||
              drug;
            const title = `${name} label`;
            const text = hitExcerpt(query, title, body);
            const ndc = label.openfda.product_ndc?.[0];
            hits.push({
              title,
              source: "FDA label",
              sourceClass: "authoritative",
              claimRole: "label_or_regulatory_notice",
              section: "label",
              url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${encodeURIComponent(drug)}%22&limit=1`,
              excerpt: text.excerpt,
              excerptTruncated: text.excerptTruncated,
              framing: framingFor({
                source: "FDA label",
                claimRole: "label_or_regulatory_notice",
                sourceClass: "authoritative",
              }),
              identifiers: ndc ? [{ type: "NDC", value: ndc }] : undefined,
              lexicalOverlap: text.lexicalOverlap,
            });
          }
        }
      } catch (error) {
        warnings.push({
          code: "channel_failed",
          source: "labels",
          message: error instanceof Error ? error.message : "Label search failed",
        });
      }
      if (hits.length === 0 && warnings.length === 0) {
        warnings.push({
          code: "no_results",
          source: "labels",
          message: "No FDA label excerpts were returned.",
        });
      }
      return { hits: hits.slice(0, opts.limit), warnings };
    },
  };
}

export function createSafetyProvider(deps: MedicalDeps): ResearchProvider {
  return {
    id: "safety",
    async search(query, opts) {
      try {
        const result = await deps.searchSafety(query, opts.limit);
        const warnings: ProviderOutcome["warnings"] = result.errors.map((error) => ({
          code: "channel_failed" as const,
          source: error.source,
          message: error.message,
        }));
        const hits = result.items.slice(0, opts.limit).map((event) => mapSafety(query, event));
        if (hits.length === 0 && warnings.length === 0) {
          warnings.push({
            code: "no_results",
            source: "safety",
            message: "No safety records were returned.",
          });
        }
        return { hits, warnings };
      } catch (error) {
        return {
          hits: [],
          warnings: [
            {
              code: "channel_failed",
              source: "safety",
              message: error instanceof Error ? error.message : "Safety search failed",
            },
          ],
        };
      }
    },
  };
}

function mapSafety(query: string, event: SafetyEvent): ResearchHit {
  const surveillance = event.kind === "adverse_event";
  const title = event.title;
  const text = hitExcerpt(query, title, event.summary || "");
  const claimRole = surveillance ? "spontaneous_report" : "label_or_regulatory_notice";
  const sourceClass = surveillance ? "regulatory_surveillance" : "authoritative";
  return {
    title,
    source: event.source,
    sourceClass,
    claimRole,
    section: surveillance ? "surveillance" : "label",
    url: event.url,
    publishedAt: parseLooseDate(event.date),
    dateUnknown: !parseLooseDate(event.date),
    excerpt: text.excerpt,
    excerptTruncated: text.excerptTruncated,
    framing: framingFor({ source: event.source, claimRole, sourceClass }),
    identifiers: event.id ? [{ type: "Report ID", value: event.id }] : undefined,
    lexicalOverlap: text.lexicalOverlap,
  };
}

export function createPubMedProvider(deps: MedicalDeps): ResearchProvider {
  return {
    id: "pubmed",
    async search(query, opts) {
      try {
        const articles = await deps.searchPubMed(query, opts.limit);
        const hits = articles.slice(0, opts.limit).map((article) => mapArticle(query, article));
        const warnings: ProviderOutcome["warnings"] =
          hits.length === 0
            ? [
                {
                  code: "no_results",
                  source: "pubmed",
                  message: "No PubMed records were returned.",
                },
              ]
            : [];
        return { hits, warnings };
      } catch (error) {
        return {
          hits: [],
          warnings: [
            {
              code: "channel_failed",
              source: "pubmed",
              message: error instanceof Error ? error.message : "PubMed search failed",
            },
          ],
        };
      }
    },
  };
}

function mapArticle(query: string, article: PubMedArticle): ResearchHit {
  const title = article.title || `PMID ${article.pmid}`;
  const text = hitExcerpt(query, title, article.abstract || "");
  const publishedAt = parseLooseDate(article.publication_date);
  const tag = formatEvidenceTag(classifyEvidence(article.title, article.abstract));
  return {
    title,
    source: "PubMed",
    sourceClass: "scientific",
    claimRole: "study_report",
    section: "studies",
    url: article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : undefined,
    publishedAt,
    dateUnknown: !publishedAt,
    excerpt: text.excerpt,
    excerptTruncated: text.excerptTruncated,
    framing: framingFor({
      source: "PubMed",
      claimRole: "study_report",
      sourceClass: "scientific",
    }),
    identifiers: article.pmid ? [{ type: "PMID", value: article.pmid }] : undefined,
    evidenceTag: tag || undefined,
    lexicalOverlap: text.lexicalOverlap,
  };
}

export function createTrialProvider(deps: MedicalDeps): ResearchProvider {
  return {
    id: "trials",
    async search(query, opts) {
      try {
        const result = await deps.searchTrials(query, opts.limit);
        const warnings: ProviderOutcome["warnings"] = result.errors.map((error) => ({
          code: "channel_failed" as const,
          source: error.source,
          message: error.message,
        }));
        const hits = result.items.slice(0, opts.limit).map((trial) => mapTrial(query, trial));
        if (hits.length === 0 && warnings.length === 0) {
          warnings.push({
            code: "no_results",
            source: "trials",
            message: "No trial registry records were returned.",
          });
        }
        return { hits, warnings };
      } catch (error) {
        return {
          hits: [],
          warnings: [
            {
              code: "channel_failed",
              source: "trials",
              message: error instanceof Error ? error.message : "Trial search failed",
            },
          ],
        };
      }
    },
  };
}

function mapTrial(query: string, trial: ClinicalTrial): ResearchHit {
  const title = trial.title;
  const text = hitExcerpt(query, title, trial.summary || "");
  const publishedAt = parseLooseDate(trial.startDate);
  return {
    title,
    source: trial.source || "ClinicalTrials.gov",
    sourceClass: "scientific",
    claimRole: "trial_registry",
    section: "trials",
    url: trial.url,
    publishedAt,
    dateUnknown: !publishedAt,
    excerpt: text.excerpt,
    excerptTruncated: text.excerptTruncated,
    framing: framingFor({
      source: trial.source || "ClinicalTrials.gov",
      claimRole: "trial_registry",
      sourceClass: "scientific",
    }),
    identifiers: trial.id ? [{ type: "Trial ID", value: trial.id }] : undefined,
    lexicalOverlap: text.lexicalOverlap,
  };
}

export function inProcessProviders(
  sources: string[],
  deps: MedicalDeps,
): ResearchProvider[] {
  const providers: ResearchProvider[] = [];
  if (sources.includes("authoritative")) {
    providers.push(createLabelProvider(deps), createSafetyProvider(deps));
  }
  if (sources.includes("scientific")) {
    providers.push(createPubMedProvider(deps), createTrialProvider(deps));
  }
  return providers;
}

export function drugTermsIn(query: string): string[] {
  return extractDrugTerms(query);
}

export type { ResearchSearchOpts };
