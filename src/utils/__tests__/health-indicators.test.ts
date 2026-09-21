import { createErrorResponse, formatHealthIndicators } from "../../utils.js";

function whoRow(
  name: string,
  code: string,
  sex: string,
  value: number,
): Record<string, unknown> {
  return {
    IndicatorName: name,
    IndicatorCode: code,
    SpatialDim: "AUS",
    TimeDim: "2021",
    Value: String(value),
    NumericValue: value,
    Sex: sex,
    Low: 0,
    High: 0,
    Comments: "No additional context",
  };
}

describe("WHO health statistics formatting", () => {
  test("header counts match the rows shown when a limit is applied", () => {
    const rows = [
      whoRow("Life expectancy at birth (years)", "WHOSIS_000001", "Both sexes", 83),
      whoRow("Life expectancy at birth (years)", "WHOSIS_000001", "Female", 85),
      whoRow("Life expectancy at birth (years)", "WHOSIS_000001", "Male", 81),
      whoRow(
        "Healthy life expectancy (HALE) at birth (years)",
        "WHOSIS_000002",
        "Both sexes",
        71,
      ),
      whoRow(
        "Healthy life expectancy (HALE) at birth (years)",
        "WHOSIS_000002",
        "Female",
        73,
      ),
      whoRow(
        "Healthy life expectancy (HALE) at birth (years)",
        "WHOSIS_000002",
        "Male",
        69,
      ),
      whoRow("Life expectancy at age 60 (years)", "WHOSIS_000015", "Both sexes", 25),
      whoRow("Life expectancy at age 60 (years)", "WHOSIS_000015", "Female", 27),
      whoRow("Life expectancy at age 60 (years)", "WHOSIS_000015", "Male", 23),
    ];
    const text = formatHealthIndicators(rows, "Life expectancy", "AUS", 3)
      .content[0].text;
    expect(text).toContain("Showing 3 of 9 data point(s) across 1 of 3 categories");
    expect(text).not.toMatch(/^Found 9 data point/m);
    expect((text.match(/^\d+\. \*\*/gm) || []).length).toBe(3);
    expect(text).toContain("Source: https://www.who.int/data/gho/data/indicators/indicator-details/GHO/WHOSIS_000001");
    expect(text).toContain("Country page: https://data.who.int/countries/AUS");

    const full = formatHealthIndicators(rows, "Life expectancy", "AUS", 20)
      .content[0].text;
    expect(full).toContain("Found 9 data point(s) across 3 categories");
    expect(full).toContain("Life Expectancy - Disability-Adjusted (HALE)");
    expect((full.match(/^\d+\. \*\*/gm) || []).length).toBe(9);
  });
});

describe("error responses", () => {
  test("marks validation failures as errors", () => {
    const response = createErrorResponse(
      "fetching article details",
      new Error('Invalid PMID "not-a-pmid". A PMID must be 1–10 digits, e.g. 42742671.'),
    );
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Invalid PMID");
  });
});
