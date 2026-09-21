/**
 * rankHits tests with a fake judge. No live JEV or PubMed.
 */

import { rankHits } from "../rank-hits.js";
import { formatRankedSearchHits } from "../format.js";
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

  test("six on-topic papers with maxKeep 3 keep three and list the rest as over_cap", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const onTopic: JevScores = {
      addresses: 0.9,
      usable_as_citation: 0.85,
      off_population_or_setting: 0.1,
      study_design: 3,
      human_clinical: 0.95,
    };
    const hits = Array.from({ length: 6 }, (_, i) => ({
      title: `On-topic paper ${i + 1}`,
      pmid: String(1000 + i),
    }));
    const ranked = await rankHits({
      question: "Do SGLT2 inhibitors reduce hospitalization in HFrEF?",
      hits,
      maxKeep: 3,
      judge: async () => ok(onTopic),
    });
    expect(ranked.kept).toHaveLength(3);
    expect(ranked.omitted).toHaveLength(3);
    expect(ranked.omitted.every((hit) => hit.rank.flags.includes("over_cap"))).toBe(
      true,
    );
  });

  test("original SELECT trial still appears when it misses the top cut", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const scoresByPmid: Record<string, JevScores> = {
      "38740993": {
        addresses: 0.95,
        usable_as_citation: 0.9,
        off_population_or_setting: 0.05,
        study_design: 4,
        human_clinical: 0.99,
      },
      "37952131": {
        addresses: 0.3,
        usable_as_citation: 0.4,
        off_population_or_setting: 0.2,
        study_design: 4,
        human_clinical: 0.99,
      },
    };
    const ranked = await rankHits({
      question:
        "What did the original SELECT randomized trial find about cardiovascular outcomes of semaglutide in adults with obesity without diabetes?",
      hits: [
        {
          title:
            "Continued Treatment With Tirzepatide for Maintenance of Weight Reduction",
          pmid: "38740993",
          abstract: "A secondary analysis of weight loss.",
        },
        {
          title:
            "Semaglutide and Cardiovascular Outcomes in Patients with Overweight or Obesity",
          pmid: "37952131",
          abstract:
            "A randomized, double-blind trial of once-weekly semaglutide 2.4 mg.",
        },
      ],
      maxKeep: 1,
      judge: async (state) => {
        const pmid = state.title.includes("Semaglutide and Cardiovascular")
          ? "37952131"
          : "38740993";
        return ok(scoresByPmid[pmid]);
      },
    });
    expect(ranked.kept).toHaveLength(1);
    expect(ranked.kept[0].pmid).toBe("38740993");
    expect(ranked.omitted.some((hit) => hit.pmid === "37952131")).toBe(true);

    const formatted = formatRankedSearchHits(ranked, ranked.question);
    const text = formatted.content[0].text;
    expect(text).toContain("Also retrieved");
    expect(text).toContain("37952131");
  });
});
