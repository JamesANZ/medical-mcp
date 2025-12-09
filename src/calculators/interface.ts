/**
 * Standard Calculator Interface
 *
 * Defines the standard interface for all calculators
 */

import type {
  CalculatorResult,
  CalculatorParameters,
  SafetyWarning,
} from "../types.js";
import { validatePositiveNumbers } from "./validators/extremes.js";
import { checkExtremeValues } from "./validators/extremes.js";
import { checkContraindications } from "./safety/contraindications.js";
import { formatWithDisclaimer } from "../safety/disclaimers.js";

export interface CalculatorContext {
  calculatorType: string;
  parameters: CalculatorParameters;
}

export interface CalculatorResponse {
  result: CalculatorResult;
  formattedOutput: string;
}

/**
 * Standard calculator wrapper that handles validation and safety checks
 */
export function executeCalculator(
  calculatorType: string,
  parameters: CalculatorParameters,
  calculateFn: (params: CalculatorParameters) => CalculatorResult,
): CalculatorResponse {
  // Validate positive numbers
  const positiveErrors = validatePositiveNumbers(parameters);
  if (positiveErrors.length > 0) {
    throw new Error(`Validation errors: ${positiveErrors.join(", ")}`);
  }

  // Check for extreme values
  const extremeChecks = checkExtremeValues(parameters);
  const errors = extremeChecks.filter((c) => c.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Extreme value errors: ${errors.map((e) => e.message).join(", ")}`,
    );
  }

  // Calculate result
  const result = calculateFn(parameters);

  // Add safety warnings
  const warnings: SafetyWarning[] = [...(result.warnings || [])];

  // Add extreme value warnings
  extremeChecks
    .filter((c) => c.severity === "warning")
    .forEach((check) => {
      warnings.push({
        level: "warning",
        message: check.message,
      });
    });

  // Add contraindication warnings
  const contraindications = checkContraindications(calculatorType, parameters);
  warnings.push(...contraindications);

  // Format output
  const formattedOutput = formatCalculatorOutput(
    {
      ...result,
      warnings,
    },
    calculatorType,
  );

  return {
    result: {
      ...result,
      warnings,
    },
    formattedOutput: formatWithDisclaimer(formattedOutput, calculatorType),
  };
}

/**
 * Format calculator output for display
 */
function formatCalculatorOutput(
  result: CalculatorResult,
  calculatorType: string,
): string {
  let output = `**Calculator: ${calculatorType.toUpperCase()}**\n\n`;

  if (result.formula) {
    output += `**Formula:** ${result.formula}\n\n`;
  }

  output += `**Result:** ${result.value}`;
  if (result.unit) {
    output += ` ${result.unit}`;
  }
  output += `\n\n`;

  if (result.interpretation) {
    output += `**Interpretation:** ${result.interpretation}\n\n`;
  }

  if (result.warnings && result.warnings.length > 0) {
    output += `**Warnings:**\n`;
    result.warnings.forEach((warning) => {
      const icon =
        warning.level === "error"
          ? "🚨"
          : warning.level === "warning"
            ? "⚠️"
            : "ℹ️";
      output += `${icon} ${warning.message}\n`;
    });
    output += `\n`;
  }

  if (result.notes && result.notes.length > 0) {
    output += `**Notes:**\n`;
    result.notes.forEach((note) => {
      output += `• ${note}\n`;
    });
    output += `\n`;
  }

  if (result.citation) {
    output += `**Reference:** ${result.citation}\n`;
  }

  return output;
}
