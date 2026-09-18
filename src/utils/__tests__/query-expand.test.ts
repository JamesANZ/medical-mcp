import { getBuildString } from "../build-info.js";
import { expandGuidelineQuery, expandPediatricQuery } from "../query-expand.js";

describe("guideline query expansion", () => {
  test("phrases atrial fibrillation, maps MeSH, and boosts practice guidelines", () => {
    const expanded = expandGuidelineQuery(
      "atrial fibrillation anticoagulation",
    );
    expect(expanded.concepts).toEqual(
      expect.arrayContaining(["atrial-fibrillation", "anticoagulation"]),
    );
    expect(expanded.pubmedTerm).toContain('"Atrial Fibrillation"[mh]');
    expect(expanded.pubmedTerm).toContain('"Anticoagulants"[mh]');
    expect(expanded.pubmedTerm).toContain('"Practice Guideline"[pt]');
    expect(expanded.pubmedTerm).toContain("anticoagul*");
  });
});

describe("AAP pediatric query expansion", () => {
  test("expands RSV and nirsevimab to shared synonyms", () => {
    const rsv = expandPediatricQuery("RSV");
    expect(rsv).toMatch(/respiratory syncytial virus/i);
    expect(rsv).toMatch(/nirsevimab/i);
    const nirsevimab = expandPediatricQuery("nirsevimab");
    expect(nirsevimab).toMatch(/beyfortus/i);
    expect(nirsevimab).toMatch(/RSV/);
  });
});

describe("build string", () => {
  test("identifies this package and a revision", () => {
    expect(getBuildString()).toMatch(
      /^medical-mcp@\d+\.\d+\.\d+\+[A-Za-z0-9]+$/,
    );
  });
});
