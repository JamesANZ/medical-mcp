/**
 * Critical Care Calculators
 *
 * SOFA, qSOFA, Wells Score, CURB-65, Child-Pugh, MELD, Apache II, etc.
 */

import type { CalculatorResult, CalculatorParameters } from "../../types.js";
import { validateAge, validateCreatinine } from "../validators/ranges.js";

/**
 * Calculate SOFA (Sequential Organ Failure Assessment) Score
 * Used to assess organ dysfunction in ICU patients
 */
export function calculateSOFA(params: CalculatorParameters): CalculatorResult {
  const respiratory = (params.respiratory as number) || 0; // PaO2/FiO2 ratio
  const platelets = (params.platelets as number) || 0; // ×10³/μL
  const bilirubin = (params.bilirubin as number) || 0; // mg/dL
  const cardiovascular = (params.cardiovascular as number) || 0; // MAP or vasopressor use
  const cns = (params.cns as number) || 0; // Glasgow Coma Scale
  const creatinine = (params.creatinine as number) || 0; // mg/dL or urine output

  // Simplified SOFA scoring (full implementation would have detailed scoring tables)
  let score = 0;
  const components: string[] = [];

  // Respiratory (PaO2/FiO2)
  if (respiratory < 100) {
    score += 4;
    components.push("Respiratory: 4");
  } else if (respiratory < 200) {
    score += 3;
    components.push("Respiratory: 3");
  } else if (respiratory < 300) {
    score += 2;
    components.push("Respiratory: 2");
  } else if (respiratory < 400) {
    score += 1;
    components.push("Respiratory: 1");
  }

  // Platelets
  if (platelets < 20) {
    score += 4;
    components.push("Platelets: 4");
  } else if (platelets < 50) {
    score += 3;
    components.push("Platelets: 3");
  } else if (platelets < 100) {
    score += 2;
    components.push("Platelets: 2");
  } else if (platelets < 150) {
    score += 1;
    components.push("Platelets: 1");
  }

  // Bilirubin
  if (bilirubin >= 12) {
    score += 4;
    components.push("Bilirubin: 4");
  } else if (bilirubin >= 6) {
    score += 3;
    components.push("Bilirubin: 3");
  } else if (bilirubin >= 2) {
    score += 2;
    components.push("Bilirubin: 2");
  } else if (bilirubin >= 1.2) {
    score += 1;
    components.push("Bilirubin: 1");
  }

  // Cardiovascular (simplified - would need MAP/vasopressor details)
  if (cardiovascular >= 3) {
    score += 4;
    components.push("Cardiovascular: 4");
  } else if (cardiovascular >= 2) {
    score += 3;
    components.push("Cardiovascular: 3");
  } else if (cardiovascular >= 1) {
    score += 1;
    components.push("Cardiovascular: 1");
  }

  // CNS (Glasgow Coma Scale)
  if (cns < 6) {
    score += 4;
    components.push("CNS: 4");
  } else if (cns < 10) {
    score += 3;
    components.push("CNS: 3");
  } else if (cns < 13) {
    score += 2;
    components.push("CNS: 2");
  } else if (cns < 15) {
    score += 1;
    components.push("CNS: 1");
  }

  // Renal (creatinine or urine output)
  if (creatinine >= 5 || params.urineOutput === 0) {
    score += 4;
    components.push("Renal: 4");
  } else if (creatinine >= 3.5) {
    score += 3;
    components.push("Renal: 3");
  } else if (creatinine >= 2) {
    score += 2;
    components.push("Renal: 2");
  } else if (creatinine >= 1.2) {
    score += 1;
    components.push("Renal: 1");
  }

  let interpretation: string;
  if (score >= 15) {
    interpretation = "Very high risk of mortality";
  } else if (score >= 10) {
    interpretation = "High risk of mortality";
  } else if (score >= 5) {
    interpretation = "Moderate risk";
  } else {
    interpretation = "Low risk";
  }

  return {
    value: score,
    unit: "points",
    interpretation,
    formula: "SOFA = Respiratory + Platelets + Bilirubin + Cardiovascular + CNS + Renal",
    citation: "Vincent JL, et al. The SOFA (Sepsis-related Organ Failure Assessment) score to describe organ dysfunction/failure. Intensive Care Med. 1996;22(7):707-10.",
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "Maximum score: 24 points",
      "Higher scores indicate worse organ dysfunction",
      "Used to track organ failure over time in ICU patients",
    ],
  };
}

/**
 * Calculate qSOFA (quick SOFA) Score
 * Rapid bedside assessment for sepsis
 */
export function calculateQSOFA(params: CalculatorParameters): CalculatorResult {
  const alteredMentalStatus = (params.alteredMentalStatus as boolean) || false;
  const systolicBP = (params.systolicBP as number) || 0; // mmHg
  const respiratoryRate = (params.respiratoryRate as number) || 0; // breaths/min

  let score = 0;
  const components: string[] = [];

  if (alteredMentalStatus) {
    score += 1;
    components.push("Altered mental status (+1)");
  }

  if (systolicBP <= 100) {
    score += 1;
    components.push("Systolic BP ≤100 mmHg (+1)");
  }

  if (respiratoryRate >= 22) {
    score += 1;
    components.push("Respiratory rate ≥22/min (+1)");
  }

  let interpretation: string;
  if (score >= 2) {
    interpretation = "High risk of poor outcome - consider sepsis evaluation";
  } else {
    interpretation = "Low risk";
  }

  return {
    value: score,
    unit: "points",
    interpretation,
    formula: "qSOFA = Altered mental status + Systolic BP ≤100 + Respiratory rate ≥22",
    citation: "Singer M, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801-10.",
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "Maximum score: 3 points",
      "Score ≥2 suggests increased risk of poor outcome",
      "Used as a quick bedside screening tool for sepsis",
    ],
  };
}

/**
 * Calculate Wells Score for DVT/PE probability
 */
export function calculateWellsScore(params: CalculatorParameters): CalculatorResult {
  const clinicalSymptomsDVT = (params.clinicalSymptomsDVT as boolean) || false;
  const peMoreLikely = (params.peMoreLikely as boolean) || false;
  const heartRate = (params.heartRate as number) || 0; // bpm
  const immobility = (params.immobility as boolean) || false;
  const surgery = (params.surgery as boolean) || false;
  const previousDVT = (params.previousDVT as boolean) || false;
  const hemoptysis = (params.hemoptysis as boolean) || false;
  const malignancy = (params.malignancy as boolean) || false;

  let score = 0;
  const components: string[] = [];

  if (clinicalSymptomsDVT) {
    score += 3;
    components.push("Clinical symptoms of DVT (+3)");
  }

  if (peMoreLikely) {
    score += 3;
    components.push("PE more likely than alternative diagnosis (+3)");
  }

  if (heartRate > 100) {
    score += 1.5;
    components.push("Heart rate >100 bpm (+1.5)");
  }

  if (immobility || surgery) {
    score += 1.5;
    components.push("Immobility or surgery (+1.5)");
  }

  if (previousDVT) {
    score += 1.5;
    components.push("Previous DVT/PE (+1.5)");
  }

  if (hemoptysis) {
    score += 1;
    components.push("Hemoptysis (+1)");
  }

  if (malignancy) {
    score += 1;
    components.push("Malignancy (+1)");
  }

  let interpretation: string;
  if (score > 6) {
    interpretation = "High probability - consider diagnostic imaging";
  } else if (score > 4) {
    interpretation = "Moderate probability - consider diagnostic imaging";
  } else {
    interpretation = "Low probability - D-dimer may be helpful";
  }

  return {
    value: Math.round(score * 10) / 10,
    unit: "points",
    interpretation,
    formula: "Wells Score = Clinical DVT symptoms + PE more likely + Heart rate + Immobility/Surgery + Previous DVT/PE + Hemoptysis + Malignancy",
    citation: "Wells PS, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. J Thromb Haemost. 2000;85(3):416-20.",
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "Score >6: High probability",
      "Score 4-6: Moderate probability",
      "Score <4: Low probability",
    ],
  };
}

/**
 * Calculate CURB-65 Score for pneumonia severity
 */
export function calculateCURB65(params: CalculatorParameters): CalculatorResult {
  const confusion = (params.confusion as boolean) || false;
  const urea = (params.urea as number) || 0; // mmol/L (or BUN in mg/dL)
  const respiratoryRate = (params.respiratoryRate as number) || 0; // breaths/min
  const systolicBP = (params.systolicBP as number) || 0; // mmHg
  const diastolicBP = (params.diastolicBP as number) || 0; // mmHg
  const age = (params.age as number) || 0;

  // Validate age
  const ageValidation = validateAge(age);
  if (!ageValidation.valid) {
    throw new Error(ageValidation.error);
  }

  let score = 0;
  const components: string[] = [];

  if (confusion) {
    score += 1;
    components.push("Confusion (+1)");
  }

  // Urea >7 mmol/L (or BUN >19 mg/dL)
  const ureaThreshold = params.ureaUnit === "mg/dL" ? 19 : 7;
  if (urea > ureaThreshold) {
    score += 1;
    components.push(`Urea >${ureaThreshold} ${params.ureaUnit || "mmol/L"} (+1)`);
  }

  if (respiratoryRate >= 30) {
    score += 1;
    components.push("Respiratory rate ≥30/min (+1)");
  }

  if (systolicBP < 90 || diastolicBP < 60) {
    score += 1;
    components.push("Blood pressure <90/60 mmHg (+1)");
  }

  if (age >= 65) {
    score += 1;
    components.push("Age ≥65 years (+1)");
  }

  let interpretation: string;
  let recommendation: string;

  if (score >= 3) {
    interpretation = "Severe pneumonia";
    recommendation = "Consider hospital admission, possibly ICU";
  } else if (score >= 2) {
    interpretation = "Moderate severity";
    recommendation = "Consider hospital admission";
  } else {
    interpretation = "Low severity";
    recommendation = "May be suitable for outpatient treatment";
  }

  const warnings = [];
  if (ageValidation.warning) {
    warnings.push({
      level: "warning" as const,
      message: ageValidation.warning,
    });
  }

  return {
    value: score,
    unit: "points",
    interpretation: `${interpretation} - ${recommendation}`,
    formula: "CURB-65 = Confusion + Urea + Respiratory rate + Blood pressure + Age",
    citation: "Lim WS, et al. BTS guidelines for the management of community acquired pneumonia in adults. Thorax. 2001;56 Suppl 4:IV1-64.",
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: [
      `Score components: ${components.join(", ") || "None"}`,
      "Score 0-1: Low severity, consider outpatient",
      "Score 2: Moderate severity, consider hospital admission",
      "Score ≥3: Severe, consider ICU admission",
    ],
  };
}

/**
 * Calculate Anion Gap
 * Used in metabolic acidosis evaluation
 */
export function calculateAnionGap(params: CalculatorParameters): CalculatorResult {
  const sodium = (params.sodium as number) || 0; // mEq/L
  const chloride = (params.chloride as number) || 0; // mEq/L
  const bicarbonate = (params.bicarbonate as number) || 0; // mEq/L

  if (sodium <= 0 || chloride <= 0 || bicarbonate <= 0) {
    throw new Error("Sodium, chloride, and bicarbonate must be positive values");
  }

  const anionGap = sodium - (chloride + bicarbonate);

  let interpretation: string;
  if (anionGap > 16) {
    interpretation = "High anion gap metabolic acidosis - consider: ketoacidosis, lactic acidosis, toxins, renal failure";
  } else if (anionGap < 8) {
    interpretation = "Low anion gap - consider: hypoalbuminemia, multiple myeloma, lithium toxicity";
  } else {
    interpretation = "Normal anion gap";
  }

  return {
    value: Math.round(anionGap * 10) / 10,
    unit: "mEq/L",
    interpretation,
    formula: "Anion Gap = Na⁺ - (Cl⁻ + HCO₃⁻)",
    citation: "Emmett M, Narins RG. Clinical use of the anion gap. Medicine (Baltimore). 1977;56(1):38-54.",
    notes: [
      "Normal range: 8-16 mEq/L",
      "High anion gap suggests unmeasured anions (lactate, ketones, etc.)",
      "Low anion gap is less common",
    ],
  };
}

/**
 * Calculate Child-Pugh Score for liver disease severity
 * Used to assess prognosis in cirrhosis
 */
export function calculateChildPugh(params: CalculatorParameters): CalculatorResult {
  const bilirubin = (params.bilirubin as number) || 0; // mg/dL
  const albumin = (params.albumin as number) || 0; // g/dL
  const inr = (params.inr as number) || 0;
  const ascites = (params.ascites as "none" | "mild" | "moderate-severe") || "none";
  const encephalopathy = (params.encephalopathy as "none" | "mild" | "moderate-severe") || "none";

  let score = 0;
  const components: string[] = [];

  // Bilirubin
  if (bilirubin < 2) {
    score += 1;
    components.push("Bilirubin <2 mg/dL (1)");
  } else if (bilirubin <= 3) {
    score += 2;
    components.push("Bilirubin 2-3 mg/dL (2)");
  } else {
    score += 3;
    components.push("Bilirubin >3 mg/dL (3)");
  }

  // Albumin
  if (albumin > 3.5) {
    score += 1;
    components.push("Albumin >3.5 g/dL (1)");
  } else if (albumin >= 2.8) {
    score += 2;
    components.push("Albumin 2.8-3.5 g/dL (2)");
  } else {
    score += 3;
    components.push("Albumin <2.8 g/dL (3)");
  }

  // INR
  if (inr < 1.7) {
    score += 1;
    components.push("INR <1.7 (1)");
  } else if (inr <= 2.3) {
    score += 2;
    components.push("INR 1.7-2.3 (2)");
  } else {
    score += 3;
    components.push("INR >2.3 (3)");
  }

  // Ascites
  if (ascites === "none") {
    score += 1;
    components.push("No ascites (1)");
  } else if (ascites === "mild") {
    score += 2;
    components.push("Mild ascites (2)");
  } else {
    score += 3;
    components.push("Moderate-severe ascites (3)");
  }

  // Encephalopathy
  if (encephalopathy === "none") {
    score += 1;
    components.push("No encephalopathy (1)");
  } else if (encephalopathy === "mild") {
    score += 2;
    components.push("Mild encephalopathy (2)");
  } else {
    score += 3;
    components.push("Moderate-severe encephalopathy (3)");
  }

  let interpretation: string;
  let classGrade: string;
  let prognosis: string;

  if (score <= 6) {
    interpretation = "Class A - Well-compensated disease";
    classGrade = "A";
    prognosis = "Good prognosis, 1-year survival ~100%";
  } else if (score <= 9) {
    interpretation = "Class B - Significant functional compromise";
    classGrade = "B";
    prognosis = "Moderate prognosis, 1-year survival ~80%";
  } else {
    interpretation = "Class C - Decompensated disease";
    classGrade = "C";
    prognosis = "Poor prognosis, 1-year survival ~45%";
  }

  return {
    value: score,
    unit: "points",
    interpretation: `${interpretation} (Class ${classGrade}) - ${prognosis}`,
    formula: "Child-Pugh = Bilirubin + Albumin + INR + Ascites + Encephalopathy",
    citation: "Pugh RN, et al. Transaction of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646-9.",
    notes: [
      `Score components: ${components.join(", ")}`,
      "Class A (5-6 points): Good prognosis",
      "Class B (7-9 points): Moderate prognosis",
      "Class C (10-15 points): Poor prognosis",
      "Used to assess prognosis and guide treatment in cirrhosis",
    ],
  };
}

/**
 * Calculate MELD (Model for End-Stage Liver Disease) Score
 * Used for liver transplant prioritization
 */
export function calculateMELD(params: CalculatorParameters): CalculatorResult {
  const bilirubin = (params.bilirubin as number) || 0; // mg/dL
  const inr = (params.inr as number) || 0;
  const creatinine = (params.creatinine as number) || 0; // mg/dL
  const onDialysis = (params.onDialysis as boolean) || false;

  if (bilirubin <= 0 || inr <= 0 || creatinine <= 0) {
    throw new Error("Bilirubin, INR, and creatinine must be positive values");
  }

  // MELD formula: 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43
  // Minimum values: bilirubin 1, INR 1, creatinine 1
  const bilirubinAdjusted = Math.max(bilirubin, 1);
  const inrAdjusted = Math.max(inr, 1);
  const creatinineAdjusted = onDialysis ? 4.0 : Math.max(creatinine, 1);

  let meld = 3.78 * Math.log(bilirubinAdjusted) +
    11.2 * Math.log(inrAdjusted) +
    9.57 * Math.log(creatinineAdjusted) +
    6.43;

  // Round to nearest integer
  meld = Math.round(meld);

  // MELD score is capped at 40
  if (meld > 40) {
    meld = 40;
  }

  let interpretation: string;
  if (meld >= 25) {
    interpretation = "Very high priority for liver transplant";
  } else if (meld >= 18) {
    interpretation = "High priority for liver transplant";
  } else if (meld >= 15) {
    interpretation = "Moderate priority";
  } else {
    interpretation = "Lower priority";
  }

  return {
    value: meld,
    unit: "points",
    interpretation,
    formula: "MELD = 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43",
    citation: "Kamath PS, et al. A model to predict survival in patients with end-stage liver disease. Hepatology. 2001;33(2):464-70.",
    notes: [
      `MELD Score: ${meld} points`,
      "Used for liver transplant prioritization",
      "MELD ≥25: Very high priority",
      "MELD 18-24: High priority",
      "MELD 15-17: Moderate priority",
      "MELD <15: Lower priority",
      onDialysis ? "Patient on dialysis - creatinine set to 4.0 mg/dL" : "",
    ].filter(Boolean),
  };
}
