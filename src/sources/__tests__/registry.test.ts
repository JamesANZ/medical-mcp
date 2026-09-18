import { fanoutSearch } from "../fanout.js";
import { listSources, registerSource, resetRegistry } from "../registry.js";
import { resetDefaultSources, registerDefaultSources } from "../register.js";
import { filterEmaMedicines, mapEmaMedicine } from "../adapters/ema.js";
import { mapFdaApplication, mapFdaResult } from "../adapters/fda.js";
import { mapTgaResult } from "../adapters/tga.js";
import {
  mapTinyFishResult,
  extractTinyFishResults,
  toMonidSearchInput,
} from "../adapters/tinyfish-search.js";
import { searchInternationalDrugs } from "../search-drugs.js";
import { formatRegulatoryProducts } from "../format.js";
import type { RegulatoryProduct, SourceAdapter } from "../types.js";

function fakeAdapter(
  id: string,
  country: string,
  search: SourceAdapter<RegulatoryProduct>["search"],
): SourceAdapter<RegulatoryProduct> {
  return {
    id,
    name: id,
    country,
    domain: "regulator",
    access: "rest",
    requiresKey: false,
    search,
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  };
}

describe("source registry", () => {
  beforeEach(() => {
    resetRegistry();
    resetDefaultSources();
  });

  test("registers default sources and filters by country", () => {
    registerDefaultSources();
    const au = listSources({ domain: "regulator", countries: ["AU"] });
    expect(au.map((source) => source.id)).toEqual(["tga-artg"]);
    const us = listSources({ domain: "regulator", countries: ["US"] });
    expect(us.map((source) => source.id)).toEqual(["fda", "dailymed"]);
  });

  test("rejects unsupported drug country codes", async () => {
    await expect(
      searchInternationalDrugs("metformin", 5, ["NZ"]),
    ).rejects.toThrow(/Unsupported country code\(s\): NZ/);
  });

  test("fanout merges successes and isolates failures", async () => {
    const ok = fakeAdapter("ok", "US", async () => [
      {
        source: "ok",
        country: "US",
        productName: "Aspirin",
        activeIngredients: ["aspirin"],
      },
    ]);
    const bad = fakeAdapter("bad", "EU", async () => {
      throw new Error("boom");
    });

    const result = await fanoutSearch([ok, bad], "aspirin", { limit: 5 });
    expect(result.items).toHaveLength(1);
    expect(result.errors).toEqual([{ source: "bad", message: "boom" }]);
  });
});

describe("source mappers", () => {
  test("maps FDA labels", () => {
    const product = mapFdaResult({
      openfda: {
        brand_name: ["Ozempic"],
        generic_name: ["semaglutide"],
        substance_name: ["SEMAGLUTIDE"],
        product_ndc: ["0169-4132"],
        manufacturer_name: ["Novo Nordisk"],
        dosage_form: ["INJECTION"],
        route: ["SUBCUTANEOUS"],
      },
      effective_time: "20260101",
    });
    expect(product.country).toBe("US");
    expect(product.identifier).toEqual({ type: "NDC", value: "0169-4132" });
  });

  test("maps Drugs@FDA applications to unique brands", () => {
    const products = mapFdaApplication({
      application_number: "NDA209637",
      sponsor_name: "NOVO NORDISK INC",
      products: [
        {
          brand_name: "OZEMPIC",
          dosage_form: "INJECTABLE",
          route: "SUBCUTANEOUS",
          marketing_status: "Prescription",
        },
        {
          brand_name: "OZEMPIC",
          dosage_form: "INJECTABLE",
          route: "SUBCUTANEOUS",
          marketing_status: "Prescription",
        },
      ],
      openfda: { substance_name: ["SEMAGLUTIDE"] },
    });
    expect(products).toHaveLength(1);
    expect(products[0].productName).toBe("OZEMPIC");
    expect(products[0].identifier).toEqual({
      type: "Application",
      value: "NDA209637",
    });
    expect(products[0].sponsor).toBe("NOVO NORDISK INC");
  });

  test("maps TGA ARTG entries", () => {
    const product = mapTgaResult({
      Name: "OZEMPIC semaglutide injection",
      LicenceId: "308324",
      Status: "Active",
      Sponsor: { Name: "Novo Nordisk Pharmaceuticals Pty Ltd" },
      Products: [
        {
          Ingredients: [
            { Name: "semaglutide", FormulationType: "Active" },
            { Name: "phenol", FormulationType: "Excipient" },
          ],
          Components: [
            {
              DosageForm: "Injection, solution",
              RouteOfAdministration: "Subcutaneous",
            },
          ],
        },
      ],
    });
    expect(product.country).toBe("AU");
    expect(product.activeIngredients).toEqual(["semaglutide"]);
    expect(product.identifier?.value).toBe("308324");
  });

  test("filters EMA medicines by name or INN", () => {
    const matches = filterEmaMedicines(
      [
        {
          name_of_medicine: "Ozempic",
          international_non_proprietary_name_common_name: "semaglutide",
          active_substance: "semaglutide",
          medicine_status: "Authorised",
          ema_product_number: "EMEA/H/C/004174",
        },
        {
          name_of_medicine: "Aybintio",
          active_substance: "bevacizumab",
        },
      ],
      "semaglutide",
      10,
    );
    expect(matches).toHaveLength(1);
    expect(mapEmaMedicine(matches[0]).identifier?.type).toBe("EMA number");
  });

  test("maps TinyFish research papers", () => {
    const paper = mapTinyFishResult({
      title: "Semaglutide in type 2 diabetes",
      authors: ["Smith J", "Lee K"],
      venue: "NEJM",
      year: 2024,
      cited_by_count: 12,
      url: "https://example.org/paper",
      pdf_url: "https://example.org/paper.pdf",
    });
    expect(paper.journal).toBe("NEJM");
    expect(paper.citations).toBe("12 citations");
    expect(paper.pdfUrl).toContain(".pdf");
  });

  test("maps TinyFish citation_count when cited_by_count is absent", () => {
    const paper = mapTinyFishResult({
      title: "Legacy citation field",
      citation_count: 4,
    });
    expect(paper.citations).toBe("4 citations");
  });

  test("wraps TinyFish Search as Monid queryParams", () => {
    const envelope = toMonidSearchInput("aspirin", {
      extra: { domainType: "research_paper" },
    });
    expect(envelope).toEqual({
      queryParams: {
        query: "aspirin",
        domain_type: "research_paper",
        purpose:
          "Find authoritative medical literature, guidelines, or regulator pages",
      },
    });
  });

  test("unwraps TinyFish results from a Monid output envelope", () => {
    expect(
      extractTinyFishResults({
        results: [{ title: "Paper", url: "https://example.org" }],
      }),
    ).toHaveLength(1);
    expect(extractTinyFishResults([{ title: "Direct" }])).toEqual([
      { title: "Direct" },
    ]);
    expect(extractTinyFishResults(null)).toEqual([]);
  });
});

describe("formatters", () => {
  test("groups products by country and source", () => {
    const formatted = formatRegulatoryProducts(
      [
        {
          source: "FDA",
          country: "US",
          productName: "Ozempic",
          activeIngredients: ["semaglutide"],
        },
        {
          source: "TGA ARTG",
          country: "AU",
          productName: "OZEMPIC",
          activeIngredients: ["semaglutide"],
          identifier: { type: "ARTG ID", value: "308324" },
        },
      ],
      "ozempic",
    );
    const text = formatted.content[0].text;
    expect(text).toContain("## US — FDA");
    expect(text).toContain("## AU — TGA ARTG");
    expect(text).toContain("ARTG ID: 308324");
  });
});
