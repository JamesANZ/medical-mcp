/**
 * Concentration Unit Conversions
 *
 * Common medical concentration conversions
 */

/**
 * Convert creatinine from mg/dL to μmol/L
 * Formula: μmol/L = mg/dL × 88.4
 */
export function creatinineMgDlToMicromolL(mgDl: number): number {
  return mgDl * 88.4;
}

/**
 * Convert creatinine from μmol/L to mg/dL
 * Formula: mg/dL = μmol/L ÷ 88.4
 */
export function creatinineMicromolLToMgDl(micromolL: number): number {
  return micromolL / 88.4;
}

/**
 * Convert glucose from mg/dL to mmol/L
 * Formula: mmol/L = mg/dL ÷ 18.0182
 */
export function glucoseMgDlToMmolL(mgDl: number): number {
  return mgDl / 18.0182;
}

/**
 * Convert glucose from mmol/L to mg/dL
 * Formula: mg/dL = mmol/L × 18.0182
 */
export function glucoseMmolLToMgDl(mmolL: number): number {
  return mmolL * 18.0182;
}

/**
 * Convert dosing from mg/kg to mg/m²
 * Requires BSA calculation
 */
export function mgKgToMgM2(
  mgKg: number,
  weightKg: number,
  bsaM2: number,
): number {
  const totalDoseMg = mgKg * weightKg;
  return totalDoseMg / bsaM2;
}

/**
 * Convert dosing from mg/m² to mg/kg
 * Requires BSA calculation
 */
export function mgM2ToMgKg(
  mgM2: number,
  weightKg: number,
  bsaM2: number,
): number {
  const totalDoseMg = mgM2 * bsaM2;
  return totalDoseMg / weightKg;
}
