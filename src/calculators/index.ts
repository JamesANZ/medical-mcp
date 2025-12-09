/**
 * Calculator Exports
 *
 * Central export point for all calculators
 */

import {
  calculateBMI,
  calculateBSA,
  calculateIBW,
} from "./categories/general.js";
import { calculateCHADS2VASc } from "./categories/cardiovascular.js";
import { calculateCreatinineClearance } from "./categories/renal.js";
import { calculatePediatricDosingWeight } from "./categories/dosing.js";
import type {
  CalculatorType,
  CalculatorParameters,
  CalculatorResult,
} from "../types.js";
import { executeCalculator } from "./interface.js";
import { logCalculatorUsage } from "../audit/logger.js";

/**
 * Calculator registry
 */
const CALCULATORS: Record<
  CalculatorType,
  (params: CalculatorParameters) => CalculatorResult
> = {
  bmi: calculateBMI,
  bsa: calculateBSA,
  ibw: calculateIBW,
  "chads2-vasc": calculateCHADS2VASc,
  "creatinine-clearance": calculateCreatinineClearance,
  "pediatric-dosing-weight": calculatePediatricDosingWeight,
};

/**
 * Execute a calculator with full validation and safety checks
 */
export function executeCalculatorWithSafety(
  calculatorType: CalculatorType,
  parameters: CalculatorParameters,
): { result: CalculatorResult; formattedOutput: string } {
  const calculator = CALCULATORS[calculatorType];

  if (!calculator) {
    throw new Error(`Unknown calculator type: ${calculatorType}`);
  }

  try {
    const response = executeCalculator(calculatorType, parameters, calculator);

    // Log usage for audit purposes
    logCalculatorUsage(calculatorType, parameters, response.result.value);

    return response;
  } catch (error: any) {
    // Log error
    logCalculatorUsage(calculatorType, parameters, undefined, error.message);
    throw error;
  }
}

/**
 * Get list of available calculators
 */
export function getAvailableCalculators(): CalculatorType[] {
  return Object.keys(CALCULATORS) as CalculatorType[];
}

/**
 * Check if calculator exists
 */
export function hasCalculator(
  calculatorType: string,
): calculatorType is CalculatorType {
  return calculatorType in CALCULATORS;
}
