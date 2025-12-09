/**
 * Missing Critical Calculators
 *
 * QTc correction, Glasgow Coma Scale, Parkland formula, INR dosing
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import { validateAge } from "../validators/ranges.js";

/**
 * Calculate QTc (Corrected QT interval)
 * Critical for drug safety - many drugs prolong QT interval
 */
export function calculateQTcCorrection(params: CalculatorParameters): CalculatorResult {
  const qt = (params.qt as number) || 0; // milliseconds
  const rr = (params.rr as number) || 0; // milliseconds (RR interval)
  const heartRate = (params.heartRate as number) || 0; // bpm
  const formula = (params.formula as "bazett" | "fridericia" | "framingham") || "bazett";

  if (qt <= 0) {
    throw new Error("QT interval must be positive");
  }

  // Calculate RR from heart rate if not provided
  let rrCalculated = rr;
  if (rr <= 0 && heartRate > 0) {
    rrCalculated = (60 / heartRate) * 1000; // Convert HR to RR in ms
  }

  if (rrCalculated <= 0) {
    throw new Error("Either RR interval (ms) or heart rate (bpm) must be provided");
  }

  const rrSeconds = rrCalculated / 1000;
  let qtc: number;
  let formulaName: string;
  let formulaDesc: string;

  if (formula === "bazett") {
    // Bazett's formula: QTc = QT / √(RR/1000)
    qtc = qt / Math.sqrt(rrSeconds);
    formulaName = "Bazett's";
    formulaDesc = "QTc = QT / √(RR in seconds)";
  } else if (formula === "fridericia") {
    // Fridericia's formula: QTc = QT / ∛(RR/1000)
    qtc = qt / Math.cbrt(rrSeconds);
    formulaName = "Fridericia's";
    formulaDesc = "QTc = QT / ∛(RR in seconds)";
  } else {
    // Framingham formula: QTc = QT + 0.154 × (1 - RR)
    qtc = qt + 0.154 * (1 - rrSeconds);
    formulaName = "Framingham";
    formulaDesc = "QTc = QT + 0.154 × (1 - RR)";
  }

  let interpretation: string;
  const warnings = [];

  if (qtc > 500) {
    interpretation = "Prolonged QTc - HIGH RISK of torsades de pointes";
    warnings.push({
      level: "error" as const,
      message: "QTc >500 ms is associated with high risk of torsades de pointes. Review medications and consider discontinuation of QT-prolonging drugs.",
    });
  } else if (qtc > 480) {
    interpretation = "Prolonged QTc - Moderate risk";
    warnings.push({
      level: "warning" as const,
      message: "QTc >480 ms (men) or >470 ms (women) is prolonged. Review medications for QT-prolonging effects.",
    });
  } else if (qtc > 450) {
    interpretation = "Borderline prolonged QTc";
    warnings.push({
      level: "warning" as const,
      message: "QTc >450 ms (men) or >470 ms (women) may be prolonged. Monitor and review medications.",
    });
  } else {
    interpretation = "Normal QTc";
  }

  return {
    value: Math.round(qtc),
    unit: "ms",
    interpretation,
    formula: `${formulaName} formula: ${formulaDesc}`,
    citation: "Bazett HC. An analysis of the time-relations of electrocardiograms. Heart. 1920;7:353-70.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      `Normal QTc: <450 ms (men), <470 ms (women)`,
      "Prolonged QTc increases risk of torsades de pointes",
      "Many medications can prolong QT interval",
      "Review all medications for QT-prolonging effects",
    ],
  };
}

/**
 * Calculate Glasgow Coma Scale (GCS)
 * Neurological assessment tool
 */
export function calculateGlasgowComaScale(params: CalculatorParameters): CalculatorResult {
  const eyeOpening = (params.eyeOpening as number) || 4; // 1-4
  const verbalResponse = (params.verbalResponse as number) || 5; // 1-5
  const motorResponse = (params.motorResponse as number) || 6; // 1-6

  // Validate ranges
  if (eyeOpening < 1 || eyeOpening > 4) {
    throw new Error("Eye opening score must be 1-4");
  }
  if (verbalResponse < 1 || verbalResponse > 5) {
    throw new Error("Verbal response score must be 1-5");
  }
  if (motorResponse < 1 || motorResponse > 6) {
    throw new Error("Motor response score must be 1-6");
  }

  const gcs = eyeOpening + verbalResponse + motorResponse;

  let interpretation: string;
  if (gcs <= 8) {
    interpretation = "Severe brain injury - consider intubation";
  } else if (gcs <= 12) {
    interpretation = "Moderate brain injury";
  } else {
    interpretation = "Mild or no brain injury";
  }

  return {
    value: gcs,
    unit: "points",
    interpretation,
    formula: "GCS = Eye Opening + Verbal Response + Motor Response",
    citation: "Teasdale G, Jennett B. Assessment of coma and impaired consciousness. Lancet. 1974;2(7872):81-4.",
    notes: [
      "Eye Opening: 4=Spontaneous, 3=To voice, 2=To pain, 1=None",
      "Verbal Response: 5=Oriented, 4=Confused, 3=Inappropriate words, 2=Incomprehensible, 1=None",
      "Motor Response: 6=Obeys commands, 5=Localizes pain, 4=Withdraws, 3=Abnormal flexion, 2=Extension, 1=None",
      "GCS ≤8: Severe brain injury, consider intubation",
      "GCS 9-12: Moderate brain injury",
      "GCS 13-15: Mild or no brain injury",
    ],
  };
}

/**
 * Calculate Parkland Formula for burn fluid resuscitation
 */
export function calculateParklandFormula(params: CalculatorParameters): CalculatorResult {
  const weight = (params.weight as number) || 0; // kg
  const burnPercentage = (params.burnPercentage as number) || 0; // %

  if (weight <= 0) {
    throw new Error("Weight must be positive");
  }
  if (burnPercentage <= 0 || burnPercentage > 100) {
    throw new Error("Burn percentage must be between 0 and 100");
  }

  // Parkland formula: 4 mL × weight (kg) × %TBSA
  const totalFluid = 4 * weight * burnPercentage;

  // Give half in first 8 hours, half in next 16 hours
  const first8Hours = totalFluid / 2;
  const next16Hours = totalFluid / 2;

  // Hourly rate for first 8 hours
  const hourlyRateFirst8 = first8Hours / 8;

  const warnings = [];
  if (burnPercentage > 20) {
    warnings.push({
      level: "warning" as const,
      message: "Burns >20% TBSA require specialized burn care. Transfer to burn center if possible.",
    });
  }

  return {
    value: Math.round(totalFluid),
    unit: "mL",
    interpretation: `Total fluid: ${Math.round(totalFluid)} mL over 24 hours`,
    formula: "Parkland Formula: 4 mL × weight (kg) × %TBSA",
    citation: "Baxter CR. Fluid volume and electrolyte changes in the early postburn period. Clin Plast Surg. 1974;1(4):693-703.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      `Total fluid: ${Math.round(totalFluid)} mL over 24 hours`,
      `First 8 hours: ${Math.round(first8Hours)} mL (${Math.round(hourlyRateFirst8)} mL/hour)`,
      `Next 16 hours: ${Math.round(next16Hours)} mL (${Math.round(next16Hours / 16)} mL/hour)`,
      "Use lactated Ringer's solution",
      "Adjust based on urine output (target: 0.5-1 mL/kg/hour)",
      "For burns >20% TBSA, consider transfer to burn center",
    ],
  };
}
