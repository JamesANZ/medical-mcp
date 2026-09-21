/**
 * Tiny TypeSafe System One client. One POST per paper, fail-soft.
 *
 * Search/PubMed code must not import this file — only rankHits does.
 */

import superagent from "superagent";
import { USER_AGENT } from "../constants.js";
import { logger } from "../logger.js";
import { JEV_QUESTIONS } from "./medical-questions.js";
import {
  JEV_MODEL,
  JEV_TIMEOUT_MS,
  type JevScores,
  type JevState,
} from "./types.js";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** Read at call time so tests can toggle the env var. */
export function getTypeSafeApiKey(): string {
  return process.env.TYPESAFE_API_KEY || "";
}

export function hasTypeSafeKey(): boolean {
  return getTypeSafeApiKey().length > 0;
}

export type JudgeResult =
  | { ok: true; scores: JevScores; model: string }
  | { ok: false; reason: string };

type JevAnswerBody = {
  model?: string;
  answers?: Record<string, { type?: string; noul?: number; score?: number }>;
};

/**
 * Pull our five scores out of a System One response. Missing fields mean
 * the call did not produce a usable ranking.
 */
export function parseJevAnswers(body: JevAnswerBody): JudgeResult {
  const answers = body.answers;
  if (!answers) return { ok: false, reason: "missing_answers" };

  const addresses = answers.addresses_question?.noul;
  const usable = answers.usable_as_citation?.noul;
  const off = answers.off_population_or_setting?.noul;
  const design = answers.study_design?.score;
  const human = answers.human_clinical?.noul;

  if (
    typeof addresses !== "number" ||
    typeof usable !== "number" ||
    typeof off !== "number" ||
    typeof design !== "number" ||
    typeof human !== "number"
  ) {
    return { ok: false, reason: "incomplete_answers" };
  }

  const model =
    typeof body.model === "string" && body.model.length > 0
      ? body.model
      : JEV_MODEL;

  return {
    ok: true,
    model,
    scores: {
      addresses,
      usable_as_citation: usable,
      off_population_or_setting: off,
      study_design: design,
      human_clinical: human,
    },
  };
}

/** Body we POST. Exported so tests can check the pin and question set. */
export function buildJevRequest(state: JevState) {
  return {
    model: JEV_MODEL,
    state,
    questions: JEV_QUESTIONS,
  };
}

export type JevPoster = (
  url: string,
  body: unknown,
  headers: Record<string, string>,
) => Promise<{ body: JevAnswerBody }>;

async function defaultPost(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ body: JevAnswerBody }> {
  const req = superagent
    .post(url)
    .send(body as object)
    .timeout({ response: JEV_TIMEOUT_MS, deadline: JEV_TIMEOUT_MS });
  for (const [key, value] of Object.entries(headers)) {
    req.set(key, value);
  }
  const res = await req;
  return { body: res.body as JevAnswerBody };
}

/**
 * Ask JEV about one paper. Returns ok:false on missing key, timeout, or
 * a bad response — callers then skip ranking for the whole batch.
 */
export async function judgeHit(
  state: JevState,
  post: JevPoster = defaultPost,
): Promise<JudgeResult> {
  const key = getTypeSafeApiKey();
  if (!key) return { ok: false, reason: "missing_key" };

  try {
    const res = await post(JEV_ENDPOINT, buildJevRequest(state), {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    });
    const parsed = parseJevAnswers(res.body);
    if (parsed.ok) {
      logger.info("TypeSafe", "JEV judged a literature hit", {
        metadata: { model: parsed.model },
      });
    } else {
      logger.warn("TypeSafe", `JEV response unusable: ${parsed.reason}`);
    }
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("TypeSafe", `JEV call failed: ${message}`);
    return { ok: false, reason: "call_failed" };
  }
}
