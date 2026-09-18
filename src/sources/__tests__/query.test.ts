import { mapFaersCount, mapFaersEvent } from "../adapters/faers.js";
import { mapShortage } from "../adapters/shortages.js";
import { formatSourceCatalog } from "../format.js";
import {
  dedupeBy,
  dedupeSafetyEvents,
  dedupeTrials,
  deprioritizeUnknownStatus,
  escapeLuceneToken,
  essieAnd,
  buildClinicalTrialsQuery,
  openFdaAnd,
  openFdaAnyFieldAnd,
  tokenize,
  trialMatchesDrugTerms,
} from "../query.js";
import {
  catalogSources,
  registerDefaultSources,
  resetDefaultSources,
} from "../register.js";
import { resetRegistry } from "../registry.js";
import type { ClinicalTrial, SafetyEvent } from "../types.js";

describe("query builder", () => {
  test("tokenizes and drops empties", () => {
    expect(tokenize("  motor  neurone disease ")).toEqual([
      "motor",
      "neurone",
      "disease",
    ]);
  });

  test("ANDs openFDA tokens on one field", () => {
    expect(
      openFdaAnd(
        "patient.drug.medicinalproduct",
        "zzqxwv nonexistent drug 12345",
      ),
    ).toBe(
      'patient.drug.medicinalproduct:"zzqxwv" AND patient.drug.medicinalproduct:"nonexistent" AND patient.drug.medicinalproduct:"drug" AND patient.drug.medicinalproduct:"12345"',
    );
  });

  test("ORs AND-groups across fields", () => {
    expect(
      openFdaAnyFieldAnd(["proprietary_name", "generic_name"], "valsartan"),
    ).toBe('(proprietary_name:"valsartan") OR (generic_name:"valsartan")');
  });

  test("escapes quotes and Lucene specials", () => {
    expect(escapeLuceneToken('foo"bar:baz')).toBe('foo\\"bar\\:baz');
    expect(openFdaAnd("product_description", 'foo"bar')).toBe(
      'product_description:"foo\\"bar"',
    );
  });

  test("ANDs Essie tokens and quotes punctuation", () => {
    expect(essieAnd("motor neurone disease")).toBe(
      "motor AND neurone AND disease",
    );
    expect(essieAnd("zzqxwv nonexistent drug 12345")).toBe(
      "zzqxwv AND nonexistent AND drug AND 12345",
    );
    expect(essieAnd("HER2+")).toBe('"HER2+"');
  });

  test("scopes trial searches to condition vs intervention fields", () => {
    expect(buildClinicalTrialsQuery("melanoma immunotherapy")).toEqual({
      "query.cond": "melanoma",
      "query.intr": "immunotherapy",
    });
    expect(buildClinicalTrialsQuery("motor neurone disease")).toEqual({
      "query.term": "motor AND neurone AND disease",
    });
    expect(buildClinicalTrialsQuery("atorvastatin")).toEqual({
      "query.intr": "atorvastatin",
    });
    expect(buildClinicalTrialsQuery("semaglutide heart failure")).toEqual({
      "query.cond": '"heart failure"',
      "query.intr": "semaglutide",
    });
    const hfpef = buildClinicalTrialsQuery(
      "semaglutide heart failure preserved ejection fraction",
    );
    expect(hfpef["query.intr"]).toBe("semaglutide");
    expect(hfpef["query.cond"]).toMatch(/HFpEF/);
    expect(hfpef["query.cond"]).toMatch(/heart failure/);
    expect(hfpef["query.cond"]).toMatch(/STEP-HFpEF/);
    expect(hfpef["query.term"]).toBeUndefined();
  });

  test("drops trials that do not mention the queried drug", () => {
    const exercise: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title: "Tailored Exercise Training Study Among Adults With HFpEF",
      id: "NCT07223242",
      status: "RECRUITING",
    };
    const step: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title:
        "Research Study to Investigate How Well Semaglutide Works in People Living With Heart Failure and Obesity (STEP-HFpEF)",
      id: "NCT04788511",
      acronym: "STEP-HFpEF",
      interventions: ["Semaglutide"],
      status: "COMPLETED",
    };
    const unknown: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title: "Some semaglutide study",
      id: "NCT06541509",
      status: "UNKNOWN",
    };
    expect(trialMatchesDrugTerms(exercise, ["semaglutide"])).toBe(false);
    expect(trialMatchesDrugTerms(step, ["semaglutide"])).toBe(true);
    expect(
      deprioritizeUnknownStatus([unknown, step]).map((trial) => trial.id),
    ).toEqual(["NCT04788511", "NCT06541509"]);
  });
});

describe("mappers", () => {
  test("promotes the queried FAERS drug before slicing", () => {
    const event = mapFaersEvent(
      {
        receiptdate: "20260101",
        serious: "1",
        patient: {
          reaction: [{ reactionmeddrapt: "Nausea" }],
          drug: [
            { medicinalproduct: "OMEPRAZOLE" },
            { medicinalproduct: "PREDNISONE" },
            { medicinalproduct: "ALLOPURINOL" },
            { medicinalproduct: "JAKAFI" },
            { medicinalproduct: "VORICONAZOLE" },
            { medicinalproduct: "ATORVASTATIN" },
          ],
        },
      },
      "atorvastatin",
    );
    expect(event.summary).toContain("ATORVASTATIN");
    expect(event.summary).toMatch(/Drugs: ATORVASTATIN,/);
    expect(event.id).toBeUndefined();
  });

  test("maps FAERS reaction counts as non-causal tallies", () => {
    const event = mapFaersCount({ term: "Nausea", count: 9513 }, "semaglutide");
    expect(event?.title).toBe("Nausea");
    expect(event?.summary).toContain("9,513 FAERS reports");
    expect(event?.summary).toContain("do not prove causation");
  });

  test("includes shortage availability and related_info", () => {
    const event = mapShortage({
      proprietary_name: "METHOTREXATE",
      status: "Currently in Shortage",
      shortage_reason: "Increased demand",
      availability: "Limited Availability",
      related_info: "Estimated recovery late 2026",
      update_date: "2026-09-09",
    });
    expect(event.summary).toBe(
      "Currently in Shortage — Limited Availability — Increased demand — Estimated recovery late 2026",
    );
  });
});

describe("dedupe helpers", () => {
  test("dedupeBy keeps first unique key and items without keys", () => {
    const rows = [
      { id: "a" },
      { id: "A" },
      { id: "b" },
      { id: undefined },
      { id: undefined },
    ];
    expect(dedupeBy(rows, (row) => row.id)).toEqual([
      { id: "a" },
      { id: "b" },
      { id: undefined },
      { id: undefined },
    ]);
  });

  test("dedupes trials on NCT id and keeps the first row", () => {
    const first: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title: "Melanoma study",
      id: "NCT01234567",
    };
    const duplicate: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title: "Melanoma study duplicate",
      id: "NCT01234567",
    };
    const other: ClinicalTrial = {
      source: "ClinicalTrials.gov",
      country: "US",
      title: "Other study",
      id: "NCT99999999",
    };
    const merged = dedupeTrials([first, duplicate, other]);
    expect(merged).toEqual([first, other]);
  });

  test("dedupes shortages on title plus date and keeps other kinds", () => {
    const shortageA: SafetyEvent = {
      source: "FDA Shortages",
      country: "US",
      kind: "shortage",
      title: "VALSARTAN",
      date: "2026-01-01",
    };
    const shortageDup: SafetyEvent = {
      source: "FDA Shortages",
      country: "US",
      kind: "shortage",
      title: "valsartan",
      date: "2026-01-01",
    };
    const shortageOtherDate: SafetyEvent = {
      source: "FDA Shortages",
      country: "US",
      kind: "shortage",
      title: "VALSARTAN",
      date: "2026-02-01",
    };
    const ae: SafetyEvent = {
      source: "FDA FAERS",
      country: "US",
      kind: "adverse_event",
      title: "VALSARTAN",
      date: "2026-01-01",
    };
    const recall: SafetyEvent = {
      source: "FDA Recalls",
      country: "US",
      kind: "recall",
      title: "VALSARTAN",
      date: "2026-01-01",
    };
    const merged = dedupeSafetyEvents([
      shortageA,
      shortageDup,
      shortageOtherDate,
      ae,
      recall,
    ]);
    expect(merged).toEqual([shortageA, shortageOtherDate, ae, recall]);
  });
});

describe("source catalog", () => {
  beforeEach(() => {
    resetRegistry();
    resetDefaultSources();
  });

  test("lists dedicated-tool sources and which tools reach them", () => {
    registerDefaultSources();
    const catalog = catalogSources();
    const ids = catalog.map((row) => row.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "who",
        "pubmed",
        "rxnorm",
        "google-scholar",
        "aap",
      ]),
    );
    expect(catalog.find((row) => row.id === "pubmed")?.tools).toContain(
      "search-medical-literature",
    );
    expect(catalog.find((row) => row.id === "fda-faers")?.tools).toEqual([
      "search-drug-safety",
    ]);
    expect(catalog.find((row) => row.id === "tinyfish-fetch")?.exposed).toBe(
      false,
    );
    expect(ids).not.toContain("anzctr");
    expect(ids).not.toContain("europe-pmc");
    expect(ids).not.toContain("cochrane");

    const text = formatSourceCatalog(catalog).content[0].text;
    expect(text).toContain("MCP tools on this server (16)");
    expect(text).toContain("`search-drugs`");
    expect(text).toContain("`search-medical-literature`");
    expect(text).toContain(
      "search-drugs` fans out to the five regulators only",
    );
    expect(text).toContain("not directly exposed");
    expect(text).toContain("`search-medical-literature`");
  });
});
