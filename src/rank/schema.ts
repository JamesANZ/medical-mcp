/**
 * Zod shapes for rank-search-hits. Kept here so tests can validate without
 * standing up the MCP server.
 */

import { z } from "zod";

/** One already-fetched paper. Title is required; full text is not accepted. */
export const RankSearchHitSchema = z.object({
  title: z.string().min(1, "title is required"),
  abstract: z.string().optional(),
  journal: z.string().optional(),
  date: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  authors: z.union([z.string(), z.array(z.string())]).optional(),
});

export const RankSearchHitsInputSchema = z.object({
  question: z
    .string()
    .min(1, "question is required")
    .describe(
      "General clinical question to rank against. Retrieval ranking only — not diagnosis or advice.",
    ),
  hits: z
    .array(RankSearchHitSchema)
    .min(1)
    .describe("Search hits (title + abstract). Do not send full text."),
  max_keep: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Maximum papers to keep after ranking"),
});

export type RankSearchHitsInput = z.infer<typeof RankSearchHitsInputSchema>;
