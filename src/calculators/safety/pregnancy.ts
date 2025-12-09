/**
 * Pregnancy and Lactation Warnings
 *
 * Provides warnings for dosing calculators regarding pregnancy and lactation
 */

import type { SafetyWarning } from "../../types.js";

export function checkPregnancyLactation(
  isPregnant?: boolean,
  isLactating?: boolean,
): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  if (isPregnant) {
    warnings.push({
      level: "warning",
      message:
        "Patient is pregnant. Many drugs require dose adjustments or are contraindicated in pregnancy. Consult pregnancy category and manufacturer guidelines before prescribing.",
      category: "pregnancy",
    });
  }

  if (isLactating) {
    warnings.push({
      level: "warning",
      message:
        "Patient is lactating. Consider drug transfer to breast milk and potential effects on infant. Consult lactation safety data before prescribing.",
      category: "pregnancy",
    });
  }

  return warnings;
}

/**
 * Get general pregnancy/lactation warning for dosing calculators
 */
export function getPregnancyLactationWarning(): SafetyWarning {
  return {
    level: "info",
    message:
      "If patient is pregnant or lactating, verify drug safety and dosing recommendations. Many drugs require special consideration in these populations.",
    category: "pregnancy",
  };
}
