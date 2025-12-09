/**
 * Volume Unit Conversions
 */

export function mLToL(mL: number): number {
  return mL / 1000;
}

export function LToMl(L: number): number {
  return L * 1000;
}

export function mLToFlOz(mL: number): number {
  return mL / 29.5735;
}

export function flOzToMl(flOz: number): number {
  return flOz * 29.5735;
}

/**
 * Convert volume to mL if needed
 */
export function toMl(volume: number, unit: "mL" | "L" | "flOz"): number {
  switch (unit) {
    case "mL":
      return volume;
    case "L":
      return LToMl(volume);
    case "flOz":
      return flOzToMl(volume);
    default:
      throw new Error(`Unsupported volume unit: ${unit}`);
  }
}
