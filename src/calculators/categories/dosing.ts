/**
 * Dosing Calculators
 *
 * Basic pediatric weight-based dosing calculator
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import { validateWeight, validateAge } from "../validators/ranges.js";
import {
  validatePediatricDosing,
  getPediatricAgeInfo,
} from "../validators/pediatric.js";
import { checkOverdose, checkExtremeDose } from "../safety/overdose.js";
import { getPregnancyLactationWarning } from "../safety/pregnancy.js";

/**
 * Calculate pediatric weight-based dosing
 *
 * Formula: Dose (mg) = Dose per kg (mg/kg) × Weight (kg)
 */
export function calculatePediatricDosingWeight(
  params: CalculatorParameters,
): CalculatorResult {
  const weight = params.weight as number;
  const age = params.age as number;
  const dosePerKg = params.dosePerKg as number;
  const drugName = (params.drugName as string) || "medication";
  const isPregnant = (params.isPregnant as boolean) || false;
  const isLactating = (params.isLactating as boolean) || false;

  // Validate inputs
  const weightValidation = validateWeight(weight);
  if (!weightValidation.valid) {
    throw new Error(weightValidation.error);
  }

  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  // Validate pediatric dosing
  const pediatricValidation = validatePediatricDosing(age, weight);
  if (!pediatricValidation.valid) {
    throw new Error(
      `Pediatric validation errors: ${pediatricValidation.errors.join(", ")}`,
    );
  }

  // Calculate total dose
  const totalDose = dosePerKg * weight;

  // Get pediatric age group info
  const ageInfo = getPediatricAgeInfo(age);

  // Safety checks
  const warnings = [];

  // Add validation warnings
  if (weightValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: weightValidation.warning,
    });
  }
  if (ageValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: ageValidation.warning,
    });
  }
  pediatricValidation.warnings.forEach((w) => {
    warnings.push({ level: "warning" as const, message: w });
  });

  // Check for overdose
  const overdoseWarnings = checkOverdose(drugName, dosePerKg, weight);
  warnings.push(...overdoseWarnings);

  // Check for extreme doses
  const extremeDoseWarnings = checkExtremeDose(dosePerKg);
  warnings.push(...extremeDoseWarnings);

  // Pregnancy/lactation warnings
  if (isPregnant || isLactating) {
    warnings.push(getPregnancyLactationWarning());
  }

  // Add pediatric-specific note
  warnings.push({
    level: "info" as const,
    message: `Patient age group: ${ageInfo.description} (${ageInfo.ageRange}). Pediatric dosing may require age-specific considerations.`,
    category: "pediatric" as const,
  });

  return {
    value: Math.round(totalDose * 100) / 100, // Round to 2 decimals
    unit: "mg",
    interpretation: `Total dose: ${Math.round(totalDose * 100) / 100} mg (${dosePerKg} mg/kg × ${weight} kg)`,
    formula: `Dose (mg) = Dose per kg (mg/kg) × Weight (kg)`,
    citation:
      "Pediatric dosing guidelines vary by drug. Consult drug-specific references and institutional protocols.",
    warnings,
    notes: [
      `Drug: ${drugName}`,
      `Patient: ${age} years old, ${weight} kg (${ageInfo.description})`,
      `Dosing: ${dosePerKg} mg/kg`,
      "Always verify dosing with drug-specific references.",
      "Consider age-specific pharmacokinetic differences in pediatric patients.",
      "Monitor for therapeutic response and adverse effects.",
    ],
  };
}
