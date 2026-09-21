/**
 * Second pass over PubMed (or already-fetched) hits.
 *
 * 1. Generalize the question if it looks like a specific patient.
 * 2. Ask JEV about each paper (small pool, not one-by-one).
 * 3. Apply keep/demote/drop in policy.ts.
 *
 * If the key is missing or any call fails, return the original order and
 * drop nothing.
 */

import { classifyEvidence } from "../utils/evidence-grading.js";
import { judgeHit, hasTypeSafeKey, type JudgeResult } from "./jev-client.js";
import {
  ABSTRACT_CHAR_LIMIT,
  JEV_CONCURRENCY,
  type RankHit,
  type RankHitsResult,
  type RankedHit,
  type JevState,
} from "./types.js";
import {
  applyDegradedPolicy,
  applyPolicy,
  sortRanked,
  toRankedHit,
  type PolicyDecision,
} from "./policy.js";
import { buildJevState, generalizeQuestion } from "./medical-questions.js";

export type JudgeFn = (state: JevState) => Promise<JudgeResult>;

/**
 * Rank only when the caller asked (`question` or `rerank`). Otherwise return
 * the PubMed list unchanged so default search stays the same.
 */
export async function maybeRankLiterature<T extends RankHit>(
  articles: T[],
  args: { query: string; question?: string; rerank?: boolean },
): Promise<{
  articles: T[] | RankedHit<T>[];
  rankMeta?: import("./types.js").RankDisplayMeta;
}> {
  if (!args.question && !args.rerank) {
    return { articles };
  }
  const ranked = await rankHits({
    question: args.question || args.query,
    hits: articles,
    fallbackQuery: args.query,
  });
  return {
    articles: ranked.kept,
    rankMeta: {
      omitted: ranked.omitted.length,
      degraded: ranked.degraded,
    },
  };
}

export type RankHitsOptions<T extends RankHit> = {
  question: string;
  hits: T[];
  /** Cap on kept hits (rank-search-hits). Omit to keep every survivor. */
  maxKeep?: number;
  /** Keyword query to fall back to if the question looks like a patient. */
  fallbackQuery?: string;
  /** Injected in tests. Defaults to the live JEV client. */
  judge?: JudgeFn;
};

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Rank a list of hits against a clinical question. Search clients should call
 * this — they should not import the TypeSafe client themselves.
 */
export async function rankHits<T extends RankHit>(
  options: RankHitsOptions<T>,
): Promise<RankHitsResult<T>> {
  const { hits, maxKeep, fallbackQuery, judge = judgeHit } = options;
  const generalized = generalizeQuestion(options.question, fallbackQuery);
  const question = generalized.question;

  if (hits.length === 0) {
    return { kept: [], omitted: [], degraded: generalized.degraded, question };
  }

  if (!hasTypeSafeKey()) {
    const kept = applyDegradedPolicy(hits);
    return {
      kept: maxKeep ? kept.slice(0, maxKeep) : kept,
      omitted: [],
      degraded: true,
      question,
    };
  }

  const judgements = await mapPool(hits, JEV_CONCURRENCY, async (hit) => {
    const evidence = classifyEvidence(hit.title, hit.abstract);
    const state = buildJevState(
      question,
      {
        title: hit.title,
        abstract: hit.abstract,
        journal: hit.journal,
        date: hit.date,
        publication_date: hit.publication_date,
        publication_type:
          evidence.studyType === "Unknown" ? undefined : evidence.studyType,
        evidence_grade:
          evidence.studyType === "Unknown" ? undefined : evidence.grade,
      },
      ABSTRACT_CHAR_LIMIT,
    );
    const judged = await judge(state);
    return { hit, evidence, judged };
  });

  const failed = judgements.some((row) => !row.judged.ok);
  if (failed) {
    const kept = applyDegradedPolicy(hits);
    return {
      kept: maxKeep ? kept.slice(0, maxKeep) : kept,
      omitted: [],
      degraded: true,
      question,
    };
  }

  type Scored = RankedHit<T> & {
    demote: boolean;
    sortScore: number;
    originalIndex: number;
  };

  const scored: Scored[] = judgements.map((row, originalIndex) => {
    const judged = row.judged;
    if (!judged.ok) {
      throw new Error("unreachable: failed judgements already returned");
    }
    const applied: PolicyDecision = applyPolicy(judged.scores, row.evidence);
    const ranked = toRankedHit(row.hit, applied);
    if (generalized.degraded) {
      ranked.rank = { ...ranked.rank, degraded: true };
      if (!ranked.rank.flags.includes("degraded")) {
        ranked.rank.flags = [...ranked.rank.flags, "degraded"];
      }
    }
    return {
      ...ranked,
      demote: applied.demote,
      sortScore: applied.sortScore,
      originalIndex,
    };
  });

  const omitted = scored.filter((hit) => !hit.rank.keep);
  const survivors = sortRanked(scored.filter((hit) => hit.rank.keep));
  const kept = (maxKeep ? survivors.slice(0, maxKeep) : survivors).map(
    ({ demote: _d, sortScore: _s, originalIndex: _i, ...hit }) =>
      hit as RankedHit<T>,
  );

  return {
    kept,
    omitted: omitted.map(
      ({ demote: _d, sortScore: _s, originalIndex: _i, ...hit }) =>
        hit as RankedHit<T>,
    ),
    degraded: generalized.degraded,
    question,
  };
}
