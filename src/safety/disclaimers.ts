/**
 * Medical Disclaimers System
 *
 * Provides standardized medical disclaimers for all calculator outputs
 * to ensure legal compliance and user safety.
 */

export const MEDICAL_DISCLAIMERS = {
  PRIMARY:
    "⚠️ FOR EDUCATIONAL USE ONLY - Not a substitute for professional medical advice, diagnosis, or treatment.",
  ALWAYS_CONSULT:
    "Always consult qualified healthcare professionals for medical decisions.",
  NOT_SOLE_BASIS: "Do not use as the sole basis for clinical decisions.",
  EDUCATIONAL_PURPOSE:
    "This information is provided for educational and informational purposes only.",
} as const;

export const CALCULATOR_DISCLAIMER = `
${MEDICAL_DISCLAIMERS.PRIMARY}
${MEDICAL_DISCLAIMERS.ALWAYS_CONSULT}
${MEDICAL_DISCLAIMERS.NOT_SOLE_BASIS}
${MEDICAL_DISCLAIMERS.EDUCATIONAL_PURPOSE}

**Important Notes:**
- This calculator is a tool to assist healthcare professionals
- Results should be interpreted in clinical context
- Always verify calculations through multiple sources
- Consider individual patient factors and circumstances
- Follow established clinical guidelines and protocols
`;

export const DOSING_DISCLAIMER = `
${MEDICAL_DISCLAIMERS.PRIMARY}
${MEDICAL_DISCLAIMERS.ALWAYS_CONSULT}
${MEDICAL_DISCLAIMERS.NOT_SOLE_BASIS}

**Critical Safety Warnings for Dosing Calculators:**
- Verify patient allergies and contraindications before prescribing
- Check for drug-drug interactions
- Consider renal and hepatic function
- Adjust for age, weight, and other patient-specific factors
- Monitor therapeutic drug levels when appropriate
- Follow institutional protocols and formularies
- This calculator does not replace clinical judgment
`;

export function getCalculatorDisclaimer(calculatorType: string): string {
  const baseDisclaimer = CALCULATOR_DISCLAIMER;

  if (calculatorType.includes("dosing") || calculatorType.includes("dose")) {
    return `${baseDisclaimer}\n${DOSING_DISCLAIMER}`;
  }

  return baseDisclaimer;
}

export function formatWithDisclaimer(
  content: string,
  calculatorType: string = "",
): string {
  const disclaimer = getCalculatorDisclaimer(calculatorType);
  return `${content}\n\n---\n\n${disclaimer}`;
}
