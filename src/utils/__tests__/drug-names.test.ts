import {
  compareIngredientPreference,
  ingredientPreferenceScore,
  queryLooksLikeCombination,
} from "../drug-names.js";

describe("ingredient preference", () => {
  test("puts single-ingredient amoxicillin ahead of a clavulanate combo", () => {
    const plain = {
      productName: "AMOXICILLIN",
      genericName: "amoxicillin",
      activeIngredients: ["AMOXICILLIN"],
    };
    const combo = {
      productName: "AMOXICILLIN AND CLAVULANATE POTASSIUM",
      genericName: "amoxicillin and clavulanate potassium",
      activeIngredients: ["AMOXICILLIN", "CLAVULANATE POTASSIUM"],
    };
    expect(ingredientPreferenceScore("amoxicillin", plain)).toBeLessThan(
      ingredientPreferenceScore("amoxicillin", combo),
    );
    expect(compareIngredientPreference("amoxicillin", plain, combo)).toBeLessThan(
      0,
    );
  });

  test("does not demote a combo when the query is the combination name", () => {
    expect(queryLooksLikeCombination("amoxicillin/clavulanate")).toBe(true);
    const combo = {
      productName: "AMOXICILLIN AND CLAVULANATE POTASSIUM",
      genericName: "amoxicillin and clavulanate potassium",
      activeIngredients: ["AMOXICILLIN", "CLAVULANATE POTASSIUM"],
    };
    const plain = {
      productName: "AMOXICILLIN",
      genericName: "amoxicillin",
      activeIngredients: ["AMOXICILLIN"],
    };
    expect(ingredientPreferenceScore("amoxicillin/clavulanate", combo)).toBe(0);
    expect(ingredientPreferenceScore("amoxicillin/clavulanate", plain)).toBe(0);
    expect(
      compareIngredientPreference("amoxicillin/clavulanate", combo, plain),
    ).toBe(0);
  });
});
