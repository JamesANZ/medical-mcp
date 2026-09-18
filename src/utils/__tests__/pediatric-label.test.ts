import type { DrugLabel } from "../../types.js";
import {
  fdaLabelHasPediatricUse,
  pediatricDrugsEmptyMessage,
  extractPediatricSentence,
} from "../pediatric-label.js";

function label(
  overrides: Partial<DrugLabel> & Record<string, unknown>,
): DrugLabel {
  return {
    openfda: { generic_name: ["amoxicillin"] },
    effective_time: "20240101",
    ...overrides,
  };
}

describe("pediatric label detection", () => {
  test("treats amoxicillin and ibuprofen dosing text as pediatric", () => {
    expect(
      fdaLabelHasPediatricUse(
        label({
          dosage_and_administration: [
            "Pediatric Patients (aged 12 weeks and older): 25 mg/kg/day.",
          ],
        }),
      ),
    ).toBe(true);
    expect(
      fdaLabelHasPediatricUse(
        label({
          purpose: ["Pain reliever"],
          warnings: ["Children: do not give to children under 6 months"],
        }),
      ),
    ).toBe(true);
    expect(
      fdaLabelHasPediatricUse(
        label({
          pediatric_use: [
            "The safety and effectiveness of amoxicillin have been established in pediatric patients.",
          ],
        }),
      ),
    ).toBe(true);
  });

  test("does not treat adult-only purpose text as pediatric", () => {
    expect(
      fdaLabelHasPediatricUse(
        label({
          purpose: ["For the treatment of hypertension in adults"],
          dosage_and_administration: ["Take one tablet daily"],
        }),
      ),
    ).toBe(false);
  });
});

describe("pediatric-drugs empty state", () => {
  test("does not claim the drug is unapproved when the search failed", () => {
    const failed = pediatricDrugsEmptyMessage("amoxicillin", 0);
    expect(failed.toLowerCase()).not.toMatch(/not approved/);
    expect(failed.toLowerCase()).not.toMatch(/lacks pediatric labeling/);
    expect(failed).toMatch(/not evidence/i);

    const filtered = pediatricDrugsEmptyMessage("ibuprofen", 6);
    expect(filtered.toLowerCase()).not.toMatch(/not approved/);
    expect(filtered).toMatch(/search\/filter/i);
  });
});

describe("pediatric sentence extraction", () => {
  test("does not clip the NSAID pregnancy warning mid-sentence", () => {
    const warnings =
      "If pregnant or breast-feeding: ask a health professional before use. It is especially important not to use ibuprofen at 20 weeks or later in pregnancy unless definitely directed to do so by a doctor because it may cause problems in the unborn child or complications during delivery.";
    const extracted = extractPediatricSentence(warnings);
    expect(extracted).not.toMatch(/^child or complications/i);
    expect(extracted).toMatch(/^It is especially important/);
  });

  test("keeps a sentence that starts as a pediatric warning", () => {
    expect(
      extractPediatricSentence(
        "Keep out of reach of children. In case of overdose, get medical help or contact a Poison Control Center right away.",
      ),
    ).toBe("Keep out of reach of children.");
    expect(
      extractPediatricSentence(
        "Pediatric patients: 5 to 10 mg/kg every 6 to 8 hours as needed for fever.",
      ),
    ).toMatch(/^Pediatric patients:/);
  });
});
