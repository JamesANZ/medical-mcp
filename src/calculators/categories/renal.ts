/**
 * Renal Calculators
 *
 * Creatinine Clearance (Cockcroft-Gault) calculator
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import {
  validateAge,
  validateWeight,
  validateCreatinine,
} from "../validators/ranges.js";

/**
 * Calculate Creatinine Clearance using Cockcroft-Gault formula
 *
 * Formula:
 *   CrCl (mL/min) = [(140 - age) × weight (kg) × (0.85 if female)] / [72 × serum creatinine (mg/dL)]
 *
 * Note: Formula is validated for adults (≥18 years)
 */
export function calculateCreatinineClearance(
  params: CalculatorParameters,
): CalculatorResult {
  const age = params.age as number;
  const weight = params.weight as number;
  const creatinine = params.creatinine as number;
  const gender = (params.gender as "male" | "female") || "male";
  const isFemale = gender === "female";

  // Validate inputs
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  const weightValidation = validateWeight(weight);
  if (!weightValidation.valid) {
    throw new Error(weightValidation.error);
  }

  const creatinineValidation = validateCreatinine(creatinine);
  if (!creatinineValidation.valid) {
    throw new Error(creatinineValidation.error);
  }

  // Check age limitations
  if (age < 18) {
    throw new Error(
      "Cockcroft-Gault formula is validated for adults (≥18 years). For pediatric patients, consider Schwartz formula.",
    );
  }

  // Calculate CrCl
  const genderFactor = isFemale ? 0.85 : 1.0;
  const crCl = ((140 - age) * weight * genderFactor) / (72 * creatinine);

  // Interpret CrCl
  let interpretation: string;
  let ckdStage: string;

  if (crCl >= 90) {
    interpretation = "Normal or high";
    ckdStage = "Stage 1-2 (if kidney damage present)";
  } else if (crCl >= 60) {
    interpretation = "Mildly decreased";
    ckdStage = "Stage 2";
  } else if (crCl >= 45) {
    interpretation = "Mildly to moderately decreased";
    ckdStage = "Stage 3a";
  } else if (crCl >= 30) {
    interpretation = "Moderately to severely decreased";
    ckdStage = "Stage 3b";
  } else if (crCl >= 15) {
    interpretation = "Severely decreased";
    ckdStage = "Stage 4";
  } else {
    interpretation = "Kidney failure";
    ckdStage = "Stage 5 (dialysis may be needed)";
  }

  const warnings = [];
  if (ageValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: ageValidation.warning,
    });
  }
  if (weightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: weightValidation.warning,
    });
  }
  if (creatinineValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: creatinineValidation.warning,
    });
  }

  // Add specific warnings
  if (creatinine > 5) {
    warnings.push({
      level: "warning" as const,
      message:
        "Cockcroft-Gault formula may not be accurate in unstable renal function or acute kidney injury. Consider alternative methods.",
      category: "contraindication" as const,
    });
  }

  if (age > 80) {
    warnings.push({
      level: "info" as const,
      message:
        "Cockcroft-Gault formula may be less accurate in elderly patients (>80 years). Consider clinical context.",
      category: "contraindication" as const,
    });
  }

  return {
    value: Math.round(crCl * 10) / 10, // Round to 1 decimal
    unit: "mL/min",
    interpretation: `${interpretation} - CKD ${ckdStage}`,
    formula: `CrCl = [(140 - age) × weight (kg) × ${genderFactor}] / [72 × creatinine (mg/dL)] (Cockcroft-Gault, ${gender})`,
    citation:
      "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
    warnings,
    notes: [
      "Used for drug dosing adjustments in renal impairment.",
      "For more accurate GFR estimation, consider MDRD or CKD-EPI equations.",
      "Formula assumes stable renal function. Not accurate in acute kidney injury.",
      `Gender factor: ${isFemale ? "0.85 (female)" : "1.0 (male)"}`,
    ],
  };
}
