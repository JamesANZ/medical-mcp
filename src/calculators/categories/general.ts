/**
 * General Calculators
 *
 * BMI, BSA, IBW calculators
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import {
  validateWeight,
  validateHeight,
  validateAge,
} from "../validators/ranges.js";

/**
 * Calculate Body Mass Index (BMI)
 * Formula: BMI = weight (kg) / height (m)²
 */
export function calculateBMI(params: CalculatorParameters): CalculatorResult {
  const weight = params.weight as number;
  const height = params.height as number;
  const heightUnit = (params.heightUnit as "cm" | "m") || "cm";

  // Validate inputs
  const weightValidation = validateWeight(weight);
  if (!weightValidation.valid) {
    throw new Error(weightValidation.error);
  }

  const heightValidation = validateHeight(height);
  if (!heightValidation.valid) {
    throw new Error(heightValidation.error);
  }

  // Convert height to meters
  const heightM = heightUnit === "cm" ? height / 100 : height;

  // Calculate BMI
  const bmi = weight / (heightM * heightM);

  // Interpret BMI
  let interpretation: string;
  if (bmi < 18.5) {
    interpretation = "Underweight";
  } else if (bmi < 25) {
    interpretation = "Normal weight";
  } else if (bmi < 30) {
    interpretation = "Overweight";
  } else {
    interpretation = "Obese";
  }

  const warnings = [];
  if (weightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: weightValidation.warning,
    });
  }
  if (heightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: heightValidation.warning,
    });
  }

  return {
    value: Math.round(bmi * 10) / 10, // Round to 1 decimal
    unit: "kg/m²",
    interpretation,
    formula: "BMI = weight (kg) / height (m)²",
    citation: "World Health Organization. BMI classification.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      "BMI is a screening tool and does not directly measure body fat.",
      "May not be accurate for athletes, elderly, or those with high muscle mass.",
    ],
  };
}

/**
 * Calculate Body Surface Area (BSA) using Mosteller formula
 * Formula: BSA (m²) = √[(height (cm) × weight (kg)) / 3600]
 */
export function calculateBSA(params: CalculatorParameters): CalculatorResult {
  const weight = params.weight as number;
  const height = params.height as number;
  const heightUnit = (params.heightUnit as "cm" | "m") || "cm";

  // Validate inputs
  const weightValidation = validateWeight(weight);
  if (!weightValidation.valid) {
    throw new Error(weightValidation.error);
  }

  const heightValidation = validateHeight(height);
  if (!heightValidation.valid) {
    throw new Error(heightValidation.error);
  }

  // Convert height to cm
  const heightCm = heightUnit === "m" ? height * 100 : height;

  // Calculate BSA using Mosteller formula
  const bsa = Math.sqrt((heightCm * weight) / 3600);

  const warnings = [];
  if (weightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: weightValidation.warning,
    });
  }
  if (heightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: heightValidation.warning,
    });
  }

  return {
    value: Math.round(bsa * 100) / 100, // Round to 2 decimals
    unit: "m²",
    formula: "BSA = √[(height (cm) × weight (kg)) / 3600] (Mosteller formula)",
    citation:
      "Mosteller RD. Simplified calculation of body-surface area. N Engl J Med. 1987;317(17):1098.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      "Mosteller formula is commonly used for drug dosing and chemotherapy.",
      "Alternative formulas: DuBois (BSA = 0.007184 × height^0.725 × weight^0.425) or Haycock.",
    ],
  };
}

/**
 * Calculate Ideal Body Weight (IBW) using Devine formula
 * Formula:
 *   Men: IBW = 50 + 2.3 × (height (inches) - 60)
 *   Women: IBW = 45.5 + 2.3 × (height (inches) - 60)
 */
export function calculateIBW(params: CalculatorParameters): CalculatorResult {
  const height = params.height as number;
  const heightUnit = (params.heightUnit as "cm" | "inches") || "cm";
  const gender = (params.gender as "male" | "female") || "male";

  // Validate inputs
  const heightValidation = validateHeight(height);
  if (!heightValidation.valid) {
    throw new Error(heightValidation.error);
  }

  // Convert height to inches
  const heightInches = heightUnit === "cm" ? height / 2.54 : height;

  if (heightInches < 60) {
    throw new Error(
      "Devine formula is not validated for height < 60 inches (152 cm)",
    );
  }

  // Calculate IBW using Devine formula
  const baseWeight = gender === "male" ? 50 : 45.5;
  const ibw = baseWeight + 2.3 * (heightInches - 60);

  const warnings = [];
  if (heightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: heightValidation.warning,
    });
  }

  return {
    value: Math.round(ibw * 10) / 10, // Round to 1 decimal
    unit: "kg",
    formula:
      gender === "male"
        ? "IBW = 50 + 2.3 × (height (inches) - 60) (Devine formula, male)"
        : "IBW = 45.5 + 2.3 × (height (inches) - 60) (Devine formula, female)",
    citation:
      "Devine BJ. Gentamicin therapy. Drug Intell Clin Pharm. 1974;8:650-655.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      "IBW is used for drug dosing calculations, especially for aminoglycosides.",
      "Alternative formulas: Robinson (similar to Devine) or adjusted body weight for obese patients.",
      "For patients > 120% IBW, consider using adjusted body weight.",
    ],
  };
}
