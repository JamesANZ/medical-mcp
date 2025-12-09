/**
 * Test ICD-10 code lookup
 */

import { searchICD10Codes, formatICD10Codes } from "./build/icd10/index.js";

console.log("=".repeat(60));
console.log("Testing ICD-10 Code Lookup");
console.log("=".repeat(60));
console.log();

// Test 1: Search for diabetes
console.log("TEST 1: Search for 'diabetes'");
console.log("-".repeat(60));
try {
  const codes = await searchICD10Codes("diabetes", 5);
  const formatted = formatICD10Codes(codes, "diabetes");
  console.log(formatted);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test 2: Search for hypertension
console.log("TEST 2: Search for 'hypertension'");
console.log("-".repeat(60));
try {
  const codes = await searchICD10Codes("hypertension", 5);
  const formatted = formatICD10Codes(codes, "hypertension");
  console.log(formatted);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

// Test 3: Search for specific code
console.log("TEST 3: Search for 'E11' (Type 2 diabetes)");
console.log("-".repeat(60));
try {
  const codes = await searchICD10Codes("E11", 5);
  const formatted = formatICD10Codes(codes, "E11");
  console.log(formatted);
  console.log();
} catch (error) {
  console.error("❌ FAILED:", error.message);
  console.log();
}

console.log("=".repeat(60));
console.log("ICD-10 tests completed!");
console.log("=".repeat(60));
