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

/**
 * Calculate eGFR using MDRD (Modification of Diet in Renal Disease) equation
 * 
 * Formula (4-variable MDRD):
 * eGFR = 175 × (creatinine^-1.154) × (age^-0.203) × (0.742 if female) × (1.212 if black)
 */
export function calculateMDRD(params: CalculatorParameters): CalculatorResult {
  const age = (params.age as number) || 0;
  const creatinine = (params.creatinine as number) || 0; // mg/dL
  const gender = (params.gender as "male" | "female") || "male";
  const isFemale = gender === "female";
  const isBlack = (params.isBlack as boolean) || false;

  // Validate inputs
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  const creatinineValidation = validateCreatinine(creatinine);
  if (!creatinineValidation.valid) {
    throw new Error(creatinineValidation.error);
  }

  if (age < 18) {
    throw new Error("MDRD equation is validated for adults (≥18 years)");
  }

  // MDRD 4-variable equation
  let egfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);

  if (isFemale) {
    egfr *= 0.742;
  }

  if (isBlack) {
    egfr *= 1.212;
  }

  // Interpret eGFR
  let interpretation: string;
  let ckdStage: string;

  if (egfr >= 90) {
    interpretation = "Normal or high";
    ckdStage = "Stage 1-2 (if kidney damage present)";
  } else if (egfr >= 60) {
    interpretation = "Mildly decreased";
    ckdStage = "Stage 2";
  } else if (egfr >= 45) {
    interpretation = "Mildly to moderately decreased";
    ckdStage = "Stage 3a";
  } else if (egfr >= 30) {
    interpretation = "Moderately to severely decreased";
    ckdStage = "Stage 3b";
  } else if (egfr >= 15) {
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
  if (creatinineValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: creatinineValidation.warning,
    });
  }

  return {
    value: Math.round(egfr * 10) / 10,
    unit: "mL/min/1.73m²",
    interpretation: `${interpretation} - CKD ${ckdStage}`,
    formula: `eGFR = 175 × (creatinine^-1.154) × (age^-0.203) × ${isFemale ? "0.742" : "1.0"} × ${isBlack ? "1.212" : "1.0"} (MDRD, ${gender}${isBlack ? ", black" : ""})`,
    citation: "Levey AS, et al. A more accurate method to estimate glomerular filtration rate from serum creatinine: a new prediction equation. Ann Intern Med. 1999;130(6):461-70.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      "MDRD equation estimates GFR normalized to 1.73 m² body surface area",
      "More accurate than Cockcroft-Gault for GFR estimation",
      "Note: Race coefficient (1.212 for black) is controversial - some guidelines recommend race-neutral equations",
      "For more recent estimates, consider CKD-EPI equation",
    ],
  };
}

/**
 * Calculate eGFR using CKD-EPI (Chronic Kidney Disease Epidemiology Collaboration) equation
 * 
 * More accurate than MDRD, especially at higher GFR levels
 */
export function calculateCKDEPI(params: CalculatorParameters): CalculatorResult {
  const age = (params.age as number) || 0;
  const creatinine = (params.creatinine as number) || 0; // mg/dL
  const gender = (params.gender as "male" | "female") || "male";
  const isFemale = gender === "female";
  // Note: CKD-EPI 2021 is race-neutral, but older versions had race coefficient
  const useRaceNeutral = (params.useRaceNeutral as boolean) !== false; // Default to true

  // Validate inputs
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  const creatinineValidation = validateCreatinine(creatinine);
  if (!creatinineValidation.valid) {
    throw new Error(creatinineValidation.error);
  }

  if (age < 18) {
    throw new Error("CKD-EPI equation is validated for adults (≥18 years)");
  }

  // CKD-EPI equation (simplified - full equation has piecewise components)
  let kappa: number;
  let alpha: number;
  let minValue: number;

  if (isFemale) {
    kappa = 0.7;
    alpha = -0.329;
    minValue = Math.min(creatinine / kappa, 1);
  } else {
    kappa = 0.9;
    alpha = -0.411;
    minValue = Math.min(creatinine / kappa, 1);
  }

  let egfr = 141 * Math.pow(minValue, alpha) * Math.pow(0.993, age);

  if (isFemale) {
    egfr *= 1.018;
  }

  // Race coefficient (controversial - 2021 version is race-neutral)
  if (!useRaceNeutral && params.isBlack) {
    egfr *= 1.159;
  }

  // Interpret eGFR
  let interpretation: string;
  let ckdStage: string;

  if (egfr >= 90) {
    interpretation = "Normal or high";
    ckdStage = "Stage 1-2 (if kidney damage present)";
  } else if (egfr >= 60) {
    interpretation = "Mildly decreased";
    ckdStage = "Stage 2";
  } else if (egfr >= 45) {
    interpretation = "Mildly to moderately decreased";
    ckdStage = "Stage 3a";
  } else if (egfr >= 30) {
    interpretation = "Moderately to severely decreased";
    ckdStage = "Stage 3b";
  } else if (egfr >= 15) {
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
  if (creatinineValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: creatinineValidation.warning,
    });
  }

  if (useRaceNeutral) {
    warnings.push({
      level: "info" as const,
      message: "Using race-neutral CKD-EPI equation (2021 version). This is the current recommended approach.",
    });
  }

  return {
    value: Math.round(egfr * 10) / 10,
    unit: "mL/min/1.73m²",
    interpretation: `${interpretation} - CKD ${ckdStage}`,
    formula: `CKD-EPI equation (${useRaceNeutral ? "race-neutral" : "with race coefficient"}, ${gender})`,
    citation: "Levey AS, et al. A new equation to estimate glomerular filtration rate. Ann Intern Med. 2009;150(9):604-12.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      "CKD-EPI is more accurate than MDRD, especially at GFR >60",
      "Race-neutral version (2021) is now recommended",
      "More accurate for drug dosing than MDRD",
    ],
  };
}
