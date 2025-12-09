/**
 * Extreme Value Detection
 *
 * Detects and handles extreme or physiologically impossible values
 */

export interface ExtremeValueCheck {
  isExtreme: boolean;
  severity: "warning" | "error";
  message: string;
}

/**
 * Check for extreme values that may indicate input errors
 */
export function checkExtremeValues(
  params: Record<string, unknown>,
): ExtremeValueCheck[] {
  const checks: ExtremeValueCheck[] = [];

  // Check weight
  if (typeof params.weight === "number") {
    if (params.weight > 500) {
      checks.push({
        isExtreme: true,
        severity: "error",
        message: `Weight ${params.weight} kg is extremely high (>500 kg). Please verify input.`,
      });
    } else if (params.weight > 200) {
      checks.push({
        isExtreme: true,
        severity: "warning",
        message: `Weight ${params.weight} kg is very high (>200 kg). Please verify.`,
      });
    }

    if (params.weight < 0.5) {
      checks.push({
        isExtreme: true,
        severity: "error",
        message: `Weight ${params.weight} kg is extremely low (<0.5 kg). Please verify input.`,
      });
    }
  }

  // Check height
  if (typeof params.height === "number") {
    if (params.height > 250) {
      checks.push({
        isExtreme: true,
        severity: "error",
        message: `Height ${params.height} cm is extremely high (>250 cm). Please verify input.`,
      });
    } else if (params.height > 220) {
      checks.push({
        isExtreme: true,
        severity: "warning",
        message: `Height ${params.height} cm is very high (>220 cm). Please verify.`,
      });
    }

    if (params.height < 30) {
      checks.push({
        isExtreme: true,
        severity: "error",
        message: `Height ${params.height} cm is extremely low (<30 cm). Please verify input.`,
      });
    }
  }

  // Check age
  if (typeof params.age === "number") {
    if (params.age > 120) {
      checks.push({
        isExtreme: true,
        severity: "warning",
        message: `Age ${params.age} years is very high (>120 years). Please verify.`,
      });
    }

    if (params.age < 0) {
      checks.push({
        isExtreme: true,
        severity: "error",
        message: "Age cannot be negative.",
      });
    }
  }

  // Check creatinine
  if (typeof params.creatinine === "number") {
    if (params.creatinine > 15) {
      checks.push({
        isExtreme: true,
        severity: "warning",
        message: `Creatinine ${params.creatinine} mg/dL is very high (>15 mg/dL). Please verify and consider acute kidney injury.`,
      });
    }

    if (params.creatinine < 0.1) {
      checks.push({
        isExtreme: true,
        severity: "warning",
        message: `Creatinine ${params.creatinine} mg/dL is very low (<0.1 mg/dL). Please verify.`,
      });
    }
  }

  return checks;
}

/**
 * Validate that all required numeric parameters are positive
 */
export function validatePositiveNumbers(
  params: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number" && value < 0) {
      errors.push(`${key} cannot be negative (received: ${value})`);
    }
  }

  return errors;
}
