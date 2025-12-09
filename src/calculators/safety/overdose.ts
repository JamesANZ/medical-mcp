/**
 * Overdose Prevention
 *
 * Checks for doses exceeding maximum recommended limits
 */

import type { SafetyWarning } from "../../types.js";

// Maximum daily dose limits (in mg/kg for common drugs)
// These are examples - should be expanded with comprehensive drug database
const MAX_DAILY_DOSES: Record<string, { mgKg: number; notes: string }> = {
  acetaminophen: {
    mgKg: 75,
    notes: "Maximum 4g/day in adults, 75 mg/kg/day in children",
  },
  ibuprofen: {
    mgKg: 40,
    notes: "Maximum 2400 mg/day in adults, 40 mg/kg/day in children",
  },
  amoxicillin: {
    mgKg: 90,
    notes: "Maximum 3g/day in adults, 90 mg/kg/day in children",
  },
};

export function checkOverdose(
  drugName: string,
  doseMgKg: number,
  weightKg: number,
): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  const maxDose = MAX_DAILY_DOSES[drugName.toLowerCase()];

  if (maxDose) {
    const totalDoseMg = doseMgKg * weightKg;
    const maxTotalDoseMg = maxDose.mgKg * weightKg;

    if (doseMgKg > maxDose.mgKg) {
      warnings.push({
        level: "error",
        message: `Dose ${doseMgKg} mg/kg exceeds maximum recommended dose of ${maxDose.mgKg} mg/kg for ${drugName}. ${maxDose.notes}. DO NOT ADMINISTER without clinical review.`,
        category: "overdose",
      });
    } else if (doseMgKg > maxDose.mgKg * 0.9) {
      warnings.push({
        level: "warning",
        message: `Dose ${doseMgKg} mg/kg is approaching maximum recommended dose of ${maxDose.mgKg} mg/kg for ${drugName}. Please verify.`,
        category: "overdose",
      });
    }
  }

  return warnings;
}

/**
 * Check for extremely high doses (safety net)
 */
export function checkExtremeDose(doseMgKg: number): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  // Generic check for extremely high doses (>100 mg/kg is unusual for most drugs)
  if (doseMgKg > 100) {
    warnings.push({
      level: "error",
      message: `Dose ${doseMgKg} mg/kg is extremely high (>100 mg/kg). Please verify calculation and drug name. DO NOT ADMINISTER without clinical review.`,
      category: "overdose",
    });
  } else if (doseMgKg > 50) {
    warnings.push({
      level: "warning",
      message: `Dose ${doseMgKg} mg/kg is very high (>50 mg/kg). Please verify calculation and drug name.`,
      category: "overdose",
    });
  }

  return warnings;
}
