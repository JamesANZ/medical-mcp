/**
 * Contraindication Checking
 *
 * Checks for contraindications for specific calculators
 */

import type { SafetyWarning } from "../../types.js";

export function checkContraindications(
  calculatorType: string,
  params: Record<string, unknown>,
): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  // Creatinine Clearance (Cockcroft-Gault) contraindications
  if (calculatorType === "creatinine-clearance") {
    const creatinine = params.creatinine as number | undefined;
    const age = params.age as number | undefined;

    // Unstable renal function warning
    if (creatinine !== undefined && creatinine > 5) {
      warnings.push({
        level: "warning",
        message:
          "Cockcroft-Gault formula may not be accurate in unstable renal function or acute kidney injury. Consider alternative methods.",
        category: "contraindication",
      });
    }

    // Age limitations
    if (age !== undefined && age < 18) {
      warnings.push({
        level: "warning",
        message:
          "Cockcroft-Gault formula is validated for adults (≥18 years). For pediatric patients, consider Schwartz formula or other pediatric-specific methods.",
        category: "contraindication",
      });
    }

    if (age !== undefined && age > 80) {
      warnings.push({
        level: "info",
        message:
          "Cockcroft-Gault formula may be less accurate in elderly patients (>80 years). Consider clinical context.",
        category: "contraindication",
      });
    }
  }

  // CHADS2-VASc contraindications
  if (calculatorType === "chads2-vasc") {
    // No specific contraindications, but note that it's for atrial fibrillation
    warnings.push({
      level: "info",
      message:
        "CHADS2-VASc score is validated for patients with atrial fibrillation. Ensure patient has confirmed AF before using this score.",
      category: "contraindication",
    });
  }

  return warnings;
}
