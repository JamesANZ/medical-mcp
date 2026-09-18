import type { DrugLabel } from "../../types.js";
import {
  fdaLabelHasPediatricUse,
  pediatricDrugsEmptyMessage,
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
