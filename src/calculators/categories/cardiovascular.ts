/**
 * Cardiovascular Calculators
 *
 * CHADS2-VASc, HAS-BLED, TIMI, GRACE, Framingham, ASCVD calculators
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import { validateAge } from "../validators/ranges.js";

/**
 * Calculate CHADS2-VASc score for stroke risk in atrial fibrillation
 *
 * Scoring:
 * - Congestive heart failure: 1 point
 * - Hypertension: 1 point
 * - Age ≥75 years: 2 points
 * - Age 65-74 years: 1 point
 * - Diabetes: 1 point
 * - Stroke/TIA/Thromboembolism: 2 points
 * - Vascular disease: 1 point
 * - Sex (female): 1 point
 *
 * Maximum score: 9
 */
export function calculateCHADS2VASc(
  params: CalculatorParameters,
): CalculatorResult {
  const age = params.age as number;
  const hasCHF = (params.hasCHF as boolean) || false;
  const hasHypertension = (params.hasHypertension as boolean) || false;
  const hasDiabetes = (params.hasDiabetes as boolean) || false;
  const hasStrokeTIA = (params.hasStrokeTIA as boolean) || false;
  const hasVascularDisease = (params.hasVascularDisease as boolean) || false;
  const isFemale =
    (params.gender as string) === "female" ||
    (params.isFemale as boolean) ||
    false;

  // Validate age
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  let score = 0;
  const components: string[] = [];

  // Congestive heart failure
  if (hasCHF) {
    score += 1;
    components.push("CHF (+1)");
  }

  // Hypertension
  if (hasHypertension) {
    score += 1;
    components.push("Hypertension (+1)");
  }

  // Age
  if (age >= 75) {
    score += 2;
    components.push(`Age ≥75 years (+2)`);
  } else if (age >= 65) {
    score += 1;
    components.push(`Age 65-74 years (+1)`);
  }

  // Diabetes
  if (hasDiabetes) {
    score += 1;
    components.push("Diabetes (+1)");
  }

  // Stroke/TIA/Thromboembolism
  if (hasStrokeTIA) {
    score += 2;
    components.push("Stroke/TIA/Thromboembolism (+2)");
  }

  // Vascular disease
  if (hasVascularDisease) {
    score += 1;
    components.push("Vascular disease (+1)");
  }

  // Sex (female)
  if (isFemale) {
    score += 1;
    components.push("Female sex (+1)");
  }

  // Interpretation based on score
  let interpretation: string;
  let recommendation: string;

  if (score === 0) {
    interpretation = "Low risk";
    recommendation =
      "No anticoagulation recommended (unless other indications)";
  } else if (score === 1) {
    interpretation = "Low-moderate risk";
    recommendation = "Consider anticoagulation (warfarin, DOAC)";
  } else if (score >= 2 && score <= 4) {
    interpretation = "Moderate-high risk";
    recommendation = "Anticoagulation recommended (warfarin or DOAC)";
  } else {
    interpretation = "High risk";
    recommendation = "Anticoagulation strongly recommended (warfarin or DOAC)";
  }

  const warnings = [];
  if (ageValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: ageValidation.warning,
    });
  }

  warnings.push({
    level: "info" as const,
    message:
      "CHADS2-VASc score is validated for patients with atrial fibrillation. Ensure patient has confirmed AF before using this score.",
  });

  return {
    value: score,
    unit: "points",
    interpretation: `${interpretation} - ${recommendation}`,
    formula:
      "CHADS2-VASc = CHF + Hypertension + Age + Diabetes + Stroke/TIA + Vascular disease + Sex",
    citation:
      "Lip GY, et al. Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach: the euro heart survey on atrial fibrillation. Chest. 2010;137(2):263-72.",
    warnings,
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "This score helps guide anticoagulation decisions in atrial fibrillation.",
      "Consider bleeding risk (HAS-BLED score) when making anticoagulation decisions.",
      "DOACs (direct oral anticoagulants) are often preferred over warfarin.",
    ],
  };
}

/**
 * Calculate HAS-BLED Score for bleeding risk in anticoagulation
 * 
 * Scoring:
 * - Hypertension: 1 point
 * - Abnormal renal/liver function: 1 point each
 * - Stroke: 1 point
 * - Bleeding history: 1 point
 * - Labile INR: 1 point
 * - Elderly (>65): 1 point
 * - Drugs/alcohol: 1 point each
 * 
 * Maximum score: 9
 */
export function calculateHASBLED(
  params: CalculatorParameters,
): CalculatorResult {
  const hasHypertension = (params.hasHypertension as boolean) || false;
  const abnormalRenal = (params.abnormalRenal as boolean) || false;
  const abnormalLiver = (params.abnormalLiver as boolean) || false;
  const hasStroke = (params.hasStroke as boolean) || false;
  const bleedingHistory = (params.bleedingHistory as boolean) || false;
  const labileINR = (params.labileINR as boolean) || false;
  const age = (params.age as number) || 0;
  const drugs = (params.drugs as boolean) || false; // Antiplatelet/NSAID
  const alcohol = (params.alcohol as boolean) || false;

  // Validate age
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  let score = 0;
  const components: string[] = [];

  if (hasHypertension) {
    score += 1;
    components.push("Hypertension (+1)");
  }

  if (abnormalRenal) {
    score += 1;
    components.push("Abnormal renal function (+1)");
  }

  if (abnormalLiver) {
    score += 1;
    components.push("Abnormal liver function (+1)");
  }

  if (hasStroke) {
    score += 1;
    components.push("Stroke (+1)");
  }

  if (bleedingHistory) {
    score += 1;
    components.push("Bleeding history (+1)");
  }

  if (labileINR) {
    score += 1;
    components.push("Labile INR (+1)");
  }

  if (age > 65) {
    score += 1;
    components.push("Elderly >65 years (+1)");
  }

  if (drugs) {
    score += 1;
    components.push("Drugs (antiplatelet/NSAID) (+1)");
  }

  if (alcohol) {
    score += 1;
    components.push("Alcohol (+1)");
  }

  let interpretation: string;
  let recommendation: string;

  if (score >= 3) {
    interpretation = "High bleeding risk";
    recommendation = "Caution with anticoagulation - consider bleeding risk vs. stroke risk";
  } else {
    interpretation = "Low-moderate bleeding risk";
    recommendation = "Generally safe for anticoagulation if indicated";
  }

  const warnings = [];
  if (ageValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: ageValidation.warning,
    });
  }

  warnings.push({
    level: "info" as const,
    message: "HAS-BLED score should be used alongside CHADS2-VASc to balance stroke risk vs. bleeding risk in anticoagulation decisions.",
  });

  return {
    value: score,
    unit: "points",
    interpretation: `${interpretation} - ${recommendation}`,
    formula: "HAS-BLED = Hypertension + Abnormal renal/liver + Stroke + Bleeding + Labile INR + Elderly + Drugs + Alcohol",
    citation: "Pisters R, et al. A novel user-friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients with atrial fibrillation. Chest. 2010;138(5):1093-100.",
    warnings,
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "Score ≥3: High bleeding risk",
      "Use alongside CHADS2-VASc to balance stroke vs. bleeding risk",
      "High HAS-BLED does not necessarily contraindicate anticoagulation",
    ],
  };
}
