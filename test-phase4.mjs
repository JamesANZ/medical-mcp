/**
 * Test Phase 4 calculators
 */

import { executeCalculatorWithSafety } from "./build/calculators/index.js";

console.log("=".repeat(60));
console.log("Testing Phase 4 Calculators");
console.log("=".repeat(60));
console.log();

// Test HAS-BLED
console.log("TEST: HAS-BLED Score");
console.log("-".repeat(60));
try {
  const result = executeCalculatorWithSafety("has-bled", {
    age: 75,
    hasHypertension: true,
    abnormalRenal: false,
    abnormalLiver: false,
    hasStroke: false,
    bleedingHistory: true,
    labileINR: false,
    drugs: false,
    alcohol: false,
  });
  console.log("✅ SUCCESS");
  console.log("Score:", result.result.value, "points");
  console.log("Interpretation:", result.result.interpretation);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test MDRD
console.log("TEST: MDRD eGFR");
console.log("-".repeat(60));
try {
  const result = executeCalculatorWithSafety("mdrd", {
    age: 65,
    creatinine: 1.2,
    gender: "male",
    isBlack: false,
  });
  console.log("✅ SUCCESS");
  console.log("eGFR:", result.result.value, result.result.unit);
  console.log("Interpretation:", result.result.interpretation);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test SOFA
console.log("TEST: SOFA Score");
console.log("-".repeat(60));
try {
  const result = executeCalculatorWithSafety("sofa", {
    respiratory: 250,
    platelets: 80,
    bilirubin: 2.5,
    cardiovascular: 2,
    cns: 13,
    creatinine: 1.5,
  });
  console.log("✅ SUCCESS");
  console.log("SOFA Score:", result.result.value, "points");
  console.log("Interpretation:", result.result.interpretation);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test QTc Correction
console.log("TEST: QTc Correction");
console.log("-".repeat(60));
try {
  const result = executeCalculatorWithSafety("qtc-correction", {
    qt: 450,
    heartRate: 80,
    formula: "bazett",
  });
  console.log("✅ SUCCESS");
  console.log("QTc:", result.result.value, result.result.unit);
  console.log("Interpretation:", result.result.interpretation);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test Glasgow Coma Scale
console.log("TEST: Glasgow Coma Scale");
console.log("-".repeat(60));
try {
  const result = executeCalculatorWithSafety("glasgow-coma-scale", {
    eyeOpening: 3,
    verbalResponse: 4,
    motorResponse: 5,
  });
  console.log("✅ SUCCESS");
  console.log("GCS:", result.result.value, "points");
  console.log("Interpretation:", result.result.interpretation);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

console.log("=".repeat(60));
console.log("Phase 4 tests completed!");
console.log("=".repeat(60));
