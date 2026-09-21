/**
 * rankHits tests with a fake judge. No live JEV or PubMed.
 */

import { rankHits } from "../rank-hits.js";
import type { JevScores } from "../types.js";
import type { JudgeResult } from "../jev-client.js";

function ok(scores: JevScores): JudgeResult {
  return { ok: true, scores, model: "jev-1.13.0" };
}

describe("rankHits", () => {
  const originalKey = process.env.TYPESAFE_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
  });

  test("missing key returns original order, degraded, and drops nothing", async () => {
    delete process.env.TYPESAFE_API_KEY;
    const hits = [
      { title: "Anesthesia consensus" },
      { title: "DAPA-HF trial" },
    ];
    const judge = jest.fn();
    const ranked = await rankHits({
      question: "Do SGLT2 inhibitors reduce hospitalization in HFrEF?",
      hits,
      judge,
    });
    expect(judge).not.toHaveBeenCalled();
    expect(ranked.degraded).toBe(true);
    expect(ranked.omitted).toHaveLength(0);
    expect(ranked.kept.map((hit) => hit.title)).toEqual([
      "Anesthesia consensus",
      "DAPA-HF trial",
    ]);
    expect(ranked.kept.every((hit) => hit.rank.degraded)).toBe(true);
  });

  test("one failed JEV call degrades the whole batch", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const ranked = await rankHits({
      question: "Do SGLT2 inhibitors reduce hospitalization in HFrEF?",
      hits: [{ title: "Paper A" }, { title: "Paper B" }],
      judge: async () => ({ ok: false, reason: "call_failed" }),
    });
    expect(ranked.degraded).toBe(true);
    expect(ranked.kept).toHaveLength(2);
    expect(ranked.omitted).toHaveLength(0);
  });

  test("keeps the RCT, omits off-setting anesthesia, and respects maxKeep", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const scoresByTitle: Record<string, JevScores> = {
      "Dapagliflozin in HFrEF: a randomized trial": {
        addresses: 0.93,
        usable_as_citation: 0.9,
        off_population_or_setting: 0.05,
        study_design: 4,
        human_clinical: 0.99,
      },
      "Anesthesia consensus for SGLT2 inhibitors in HFpEF": {
        addresses: 0.18,
        usable_as_citation: 0.1,
        off_population_or_setting: 0.88,
        study_design: 1,
        human_clinical: 0.95,
      },
      "VigiBase adverse events of SGLT2 inhibitors": {
        addresses: 0.5,
        usable_as_citation: 0.35,
        off_population_or_setting: 0.3,
        study_design: 3,
        human_clinical: 0.9,
      },
    };

    const ranked = await rankHits({
      question: "Do SGLT2 inhibitors reduce hospitalization in HFrEF?",
      hits: Object.keys(scoresByTitle).map((title) => ({
        title,
        abstract: title,
      })),
      maxKeep: 5,
      judge: async (state) => ok(scoresByTitle[state.title]),
    });

    expect(ranked.kept[0].title).toMatch(/Dapagliflozin/);
    expect(ranked.omitted.some((hit) => /Anesthesia/.test(hit.title))).toBe(
      true,
    );
    const ae = ranked.kept.find((hit) => /VigiBase/.test(hit.title));
    expect(ae?.rank.flags).toContain("low_citation");
  });
});
