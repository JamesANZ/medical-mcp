/**
 * Acceptable Parameter Ranges
 *
 * Defines acceptable ranges for calculator parameters based on medical literature
 */

export const PARAMETER_RANGES = {
  weight: { min: 10, max: 500, unit: "kg", warnMin: 20, warnMax: 200 },
  height: { min: 50, max: 250, unit: "cm", warnMin: 100, warnMax: 220 },
  age: { min: 0, max: 150, unit: "years", warnMin: 0, warnMax: 120 },
  creatinine: { min: 0.1, max: 20, unit: "mg/dL", warnMin: 0.5, warnMax: 1.5 },
  heartRate: { min: 20, max: 250, unit: "bpm", warnMin: 50, warnMax: 120 },
  systolicBP: { min: 50, max: 300, unit: "mmHg", warnMin: 90, warnMax: 140 },
  diastolicBP: { min: 30, max: 200, unit: "mmHg", warnMin: 60, warnMax: 90 },
} as const;

type ParameterRange = (typeof PARAMETER_RANGES)[keyof typeof PARAMETER_RANGES];

export interface RangeValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
}

export function validateRange(
  value: number,
  paramName: keyof typeof PARAMETER_RANGES,
): RangeValidationResult {
  const range: ParameterRange = PARAMETER_RANGES[paramName] as ParameterRange;

  if (value < range.min || value > range.max) {
    return {
      valid: false,
      error: `${paramName} value ${value} ${range.unit} is outside acceptable range (${range.min}-${range.max} ${range.unit}). Please verify input.`,
    };
  }

  if (
    "warnMin" in range &&
    "warnMax" in range &&
    range.warnMin !== undefined &&
    range.warnMax !== undefined
  ) {
    if (value < range.warnMin || value > range.warnMax) {
      return {
        valid: true,
        warning: `${paramName} value ${value} ${range.unit} is outside typical range (${range.warnMin}-${range.warnMax} ${range.unit}). Please verify.`,
      };
    }
  }

  return { valid: true };
}

export function validateWeight(weight: number): RangeValidationResult {
  return validateRange(weight, "weight");
}

export function validateHeight(height: number): RangeValidationResult {
  return validateRange(height, "height");
}

export function validateAge(age: number): RangeValidationResult {
  return validateRange(age, "age");
}

export function validateCreatinine(creatinine: number): RangeValidationResult {
  return validateRange(creatinine, "creatinine");
}
