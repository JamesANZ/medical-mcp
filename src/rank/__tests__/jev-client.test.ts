/**
 * JEV client tests with a fake HTTP POST. No live TypeSafe or PubMed calls.
 */

import {
  buildJevRequest,
  judgeHit,
  parseJevAnswers,
  JEV_ENDPOINT,
} from "../jev-client.js";
import { JEV_QUESTIONS, buildJevState } from "../medical-questions.js";
import { ABSTRACT_CHAR_LIMIT, JEV_MODEL } from "../types.js";

const sampleState = buildJevState(
  "Do SGLT2 inhibitors reduce hospitalization in HFrEF?",
  {
    title: "Dapagliflozin in HFrEF",
    abstract: "A".repeat(800),
    journal: "NEJM",
    date: "2019",
    publication_type: "Randomized Controlled Trial",
    evidence_grade: "II",
  },
  ABSTRACT_CHAR_LIMIT,
);

describe("buildJevRequest", () => {
  test("pins jev-1.13.0, sends five questions, and never includes full text", () => {
    const body = buildJevRequest(sampleState);
    expect(body.model).toBe(JEV_MODEL);
    expect(Object.keys(body.questions)).toEqual(Object.keys(JEV_QUESTIONS));
    expect(JSON.stringify(body)).not.toMatch(/full_text/);
    expect(sampleState.abstract.length).toBe(ABSTRACT_CHAR_LIMIT);
  });
});

describe("parseJevAnswers", () => {
  test("reads noul and score fields", () => {
    const parsed = parseJevAnswers({
      model: "jev-1.13.0",
      answers: {
        addresses_question: { type: "noul", noul: 0.9 },
        usable_as_citation: { type: "noul", noul: 0.8 },
        off_population_or_setting: { type: "noul", noul: 0.1 },
        study_design: { type: "score", score: 4.2 },
        human_clinical: { type: "noul", noul: 0.99 },
      },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.scores.addresses).toBe(0.9);
      expect(parsed.scores.study_design).toBe(4.2);
      expect(parsed.model).toBe("jev-1.13.0");
    }
  });

  test("fails closed on incomplete answers", () => {
    const parsed = parseJevAnswers({ answers: {} });
    expect(parsed.ok).toBe(false);
  });
});

describe("judgeHit", () => {
  const originalKey = process.env.TYPESAFE_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  test("skips HTTP when the TypeSafe key is missing", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const post = jest.fn();
    const result = await judgeHit(sampleState, post);
    expect(result).toEqual({ ok: false, reason: "missing_key" });
    expect(post).not.toHaveBeenCalled();
  });

  test("posts to System One with a 3s-style call and parses the body", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const post = jest.fn(async (url: string, body: unknown) => {
      expect(url).toBe(JEV_ENDPOINT);
      expect((body as { model: string }).model).toBe(JEV_MODEL);
      return {
        body: {
          model: "jev-1.13.0",
          answers: {
            addresses_question: { noul: 0.7 },
            usable_as_citation: { noul: 0.6 },
            off_population_or_setting: { noul: 0.2 },
            study_design: { score: 4 },
            human_clinical: { noul: 1 },
          },
        },
      };
    });
    const result = await judgeHit(sampleState, post);
    expect(result.ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  test("degrades when the POST throws", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const post = jest.fn(async () => {
      throw new Error("timeout");
    });
    const result = await judgeHit(sampleState, post);
    expect(result).toEqual({ ok: false, reason: "call_failed" });
  });
});
