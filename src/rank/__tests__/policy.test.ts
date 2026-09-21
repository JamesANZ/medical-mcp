/**
 * Policy tests — fixtures only, no network.
 *
 * Ranking reorders papers. It does not say whether a treatment works.
 */

import { applyDegradedPolicy, applyPolicy, sortRanked } from "../policy.js";
import { RankSearchHitSchema, RankSearchHitsInputSchema } from "../schema.js";
import {
  generalizeQuestion,
  looksLikeSpecificPatient,
} from "../medical-questions.js";
import type { JevScores } from "../types.js";
import type { EvidenceTag } from "../../utils/evidence-grading.js";

const QUESTION = "Do SGLT2 inhibitors reduce hospitalization in HFrEF?";

const rctScores: JevScores = {
  addresses: 0.92,
  usable_as_citation: 0.88,
  off_population_or_setting: 0.08,
  study_design: 4,
  human_clinical: 0.99,
};

const anesthesiaScores: JevScores = {
  addresses: 0.22,
  usable_as_citation: 0.12,
  off_population_or_setting: 0.91,
  study_design: 1,
  human_clinical: 0.96,
};

const aeMiningScores: JevScores = {
  addresses: 0.52,
  usable_as_citation: 0.4,
  off_population_or_setting: 0.32,
  study_design: 3,
  human_clinical: 0.94,
};

const rctEvidence: EvidenceTag = {
  studyType: "Randomized Controlled Trial",
  grade: "II",
  sortPriority: 2,
};

describe("applyPolicy", () => {
  test("keeps an on-point RCT first; drops anesthesia; demotes AE mining for an efficacy question", () => {
    const rct = applyPolicy(rctScores, rctEvidence);
    const anesthesia = applyPolicy(anesthesiaScores, {
      studyType: "Expert Opinion / Editorial",
      grade: "V",
      sortPriority: 6,
    });
    const ae = applyPolicy(aeMiningScores, {
      studyType: "Cohort Study",
      grade: "III",
      sortPriority: 3,
    });

    expect(rct.keep).toBe(true);
    expect(rct.demote).toBe(false);
    expect(anesthesia.keep).toBe(false);
    expect(anesthesia.flags).toContain("off_setting");
    expect(ae.keep).toBe(true);
    expect(ae.demote).toBe(true);
    expect(ae.flags).toContain("low_citation");

    const ordered = sortRanked([
      {
        rank: ae,
        demote: ae.demote,
        sortScore: ae.sortScore,
        originalIndex: 0,
      },
      {
        rank: rct,
        demote: rct.demote,
        sortScore: rct.sortScore,
        originalIndex: 1,
      },
    ]);
    expect(ordered[0].originalIndex).toBe(1);
    expect(QUESTION).toContain("HFrEF");
  });

  test("keeps a VigiBase-style AE paper when the question is about safety", () => {
    const safetyScores: JevScores = {
      addresses: 0.86,
      usable_as_citation: 0.8,
      off_population_or_setting: 0.15,
      study_design: 3,
      human_clinical: 0.95,
    };
    const decision = applyPolicy(safetyScores, {
      studyType: "Cohort Study",
      grade: "III",
      sortPriority: 3,
    });
    expect(decision.keep).toBe(true);
    expect(decision.demote).toBe(false);
  });

  test("existing Grade I systematic review beats JEV calling it a narrative review", () => {
    const jevThinksNarrative: JevScores = {
      addresses: 0.9,
      usable_as_citation: 0.85,
      off_population_or_setting: 0.05,
      study_design: 1,
      human_clinical: 0.99,
    };
    const gradeI: EvidenceTag = {
      studyType: "Systematic Review / Meta-Analysis",
      grade: "I",
      sortPriority: 1,
    };
    const withTag = applyPolicy(jevThinksNarrative, gradeI);
    const withoutTag = applyPolicy(jevThinksNarrative, {
      studyType: "Unknown",
      grade: "N/A",
      sortPriority: 99,
    });
    expect(withTag.evidence_or_authority).toBe(1);
    expect(withoutTag.evidence_or_authority).toBeCloseTo(0.2);
    expect(withTag.evidence_or_authority).toBeGreaterThan(
      withoutTag.evidence_or_authority,
    );
  });

  test("animal-only work caps design at observational even if JEV says meta-analysis", () => {
    const animal: JevScores = {
      addresses: 0.8,
      usable_as_citation: 0.7,
      off_population_or_setting: 0.2,
      study_design: 5,
      human_clinical: 0.1,
    };
    const decision = applyPolicy(animal, {
      studyType: "Unknown",
      grade: "N/A",
      sortPriority: 99,
    });
    expect(decision.flags).toContain("animal_or_invitro");
    expect(decision.evidence_or_authority).toBeCloseTo(0.6);
  });

  test("missing TypeSafe key path keeps original order and drops nothing", () => {
    const hits = [
      { title: "Anesthesia consensus on SGLT2" },
      { title: "DAPA-HF randomized trial" },
      { title: "VigiBase AE mining" },
    ];
    const ranked = applyDegradedPolicy(hits);
    expect(ranked.map((hit) => hit.title)).toEqual(
      hits.map((hit) => hit.title),
    );
    expect(ranked.every((hit) => hit.rank.keep && hit.rank.degraded)).toBe(
      true,
    );
  });
});

describe("patient-question guard", () => {
  test("generalizes a specific-patient question", () => {
    const raw = "my 64yo with EF 30% on SGLT2 — will he stay out of hospital?";
    expect(looksLikeSpecificPatient(raw)).toBe(true);
    const { question, degraded } = generalizeQuestion(
      raw,
      "SGLT2 inhibitors heart failure",
    );
    expect(degraded).toBe(true);
    expect(question).not.toMatch(/64/);
  });
});

describe("rank-search-hits schema", () => {
  test("accepts a valid payload", () => {
    const parsed = RankSearchHitsInputSchema.parse({
      question: QUESTION,
      hits: [
        {
          title: "Dapagliflozin in Patients with Heart Failure",
          abstract: "A randomized trial of SGLT2 inhibitors in HFrEF.",
          pmid: "31535829",
        },
      ],
    });
    expect(parsed.max_keep).toBe(5);
    expect(parsed.hits).toHaveLength(1);
  });

  test("rejects a missing question", () => {
    const result = RankSearchHitsInputSchema.safeParse({
      hits: [{ title: "A trial" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects an empty title", () => {
    const result = RankSearchHitSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});
