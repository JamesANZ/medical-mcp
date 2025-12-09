/**
 * Weight Unit Conversions
 */

export function kgToLbs(kg: number): number {
  return kg * 2.20462;
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462;
}

export function kgToG(kg: number): number {
  return kg * 1000;
}

export function gToKg(g: number): number {
  return g / 1000;
}

/**
 * Convert weight to kg if needed
 */
export function toKg(weight: number, unit: "kg" | "lbs" | "g"): number {
  switch (unit) {
    case "kg":
      return weight;
    case "lbs":
      return lbsToKg(weight);
    case "g":
      return gToKg(weight);
    default:
      throw new Error(`Unsupported weight unit: ${unit}`);
  }
}
