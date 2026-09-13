/**
 * Zod Validation Schemas for Upstream API Responses
 *
 * Validates that upstream APIs haven't silently changed their response format.
 * Uses .passthrough() to allow extra fields while ensuring required fields exist.
 */

import { z } from "zod";
import { logger } from "../logger.js";

// ─── FDA Drug Label ───────────────────────────────────

export const FDAOpenFDASchema = z
  .object({
    brand_name: z.array(z.string()).optional(),
    generic_name: z.array(z.string()).optional(),
    manufacturer_name: z.array(z.string()).optional(),
    product_ndc: z.array(z.string()).optional(),
    substance_name: z.array(z.string()).optional(),
    route: z.array(z.string()).optional(),
    dosage_form: z.array(z.string()).optional(),
  })
  .passthrough();

export const FDADrugLabelSchema = z
  .object({
    openfda: FDAOpenFDASchema.optional().default({}),
    effective_time: z.string().optional().default("Unknown"),
  })
  .passthrough();

export const FDASearchResponseSchema = z
  .object({
    results: z.array(FDADrugLabelSchema).optional().default([]),
  })
  .passthrough();

// ─── PubMed E-Search ──────────────────────────────────

export const PubMedSearchResponseSchema = z
  .object({
    esearchresult: z
      .object({
        idlist: z.array(z.string()).optional().default([]),
      })
      .passthrough(),
  })
  .passthrough();

// ─── WHO Indicator ────────────────────────────────────

export const WHOIndicatorSchema = z
  .object({
    IndicatorCode: z.string(),
    IndicatorName: z.string(),
  })
  .passthrough();

export const WHOIndicatorResponseSchema = z
  .object({
    value: z.array(WHOIndicatorSchema).optional().default([]),
  })
  .passthrough();

export const WHODataValueSchema = z
  .object({
    SpatialDim: z.string().optional().default("Global"),
    TimeDim: z.union([z.string(), z.number()]).optional(),
    NumericValue: z.number().nullable().optional(),
  })
  .passthrough();

export const WHODataResponseSchema = z
  .object({
    value: z.array(WHODataValueSchema).optional().default([]),
  })
  .passthrough();

// ─── RxNorm ───────────────────────────────────────────

export const RxNormConceptSchema = z
  .object({
    rxcui: z.string().optional().default(""),
    name: z.string().optional().default(""),
    tty: z.string().optional().default(""),
    language: z.string().optional().default(""),
    suppress: z.string().optional().default(""),
  })
  .passthrough();

export const RxNormConceptGroupSchema = z
  .object({
    conceptProperties: z.array(RxNormConceptSchema).optional(),
  })
  .passthrough();

export const RxNormDrugGroupSchema = z
  .object({
    drugGroup: z
      .object({
        conceptGroup: z.array(RxNormConceptGroupSchema).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ─── ClinicalTrials.gov v2 ────────────────────────────

export const ClinicalTrialStudySchema = z
  .object({
    protocolSection: z
      .object({
        identificationModule: z
          .object({
            briefTitle: z.string().optional(),
            officialTitle: z.string().optional(),
            nctId: z.string().optional(),
            leadSponsor: z
              .object({ name: z.string().optional() })
              .passthrough()
              .optional(),
            briefSummary: z.string().optional(),
          })
          .passthrough()
          .optional(),
        statusModule: z
          .object({
            startDateStruct: z
              .object({ date: z.string().optional() })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const ClinicalTrialsResponseSchema = z
  .object({
    studies: z.array(ClinicalTrialStudySchema).optional().default([]),
  })
  .passthrough();

// ─── Semantic Scholar ─────────────────────────────────

export const SemanticScholarPaperSchema = z
  .object({
    paperId: z.string().optional(),
    title: z.string().optional().default(""),
    abstract: z.string().nullable().optional(),
    year: z.number().nullable().optional(),
    citationCount: z.number().optional().default(0),
    url: z.string().optional(),
    externalIds: z
      .object({
        DOI: z.string().optional().nullable(),
        PubMed: z.string().optional().nullable(),
        ArXiv: z.string().optional().nullable(),
      })
      .passthrough()
      .optional(),
    authors: z
      .array(
        z.object({ name: z.string().optional().default("") }).passthrough(),
      )
      .optional()
      .default([]),
    journal: z
      .object({
        name: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    publicationTypes: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

export const SemanticScholarSearchResponseSchema = z
  .object({
    total: z.number().optional().default(0),
    data: z.array(SemanticScholarPaperSchema).optional().default([]),
  })
  .passthrough();

// ─── Safe validation helper ───────────────────────────

/**
 * Validate data against a schema, returning the data as-is if validation fails
 * (with a warning logged). This prevents a schema change from breaking the server
 * while still alerting us to the problem.
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  source: string,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  // Log the validation error but don't crash
  const issues = result.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  logger.warn(
    source,
    `Response validation warning: ${issues}. Falling back to raw data.`,
  );

  return data as T;
}
