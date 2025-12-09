/**
 * Pediatric Age Group Validation
 *
 * Validates and categorizes pediatric patients by age group
 */

export type PediatricAgeGroup =
  | "neonate"
  | "infant"
  | "child"
  | "adolescent"
  | "adult";

export interface PediatricAgeInfo {
  group: PediatricAgeGroup;
  ageRange: string;
  description: string;
}

export const PEDIATRIC_AGE_GROUPS: Record<PediatricAgeGroup, PediatricAgeInfo> =
  {
    neonate: {
      group: "neonate",
      ageRange: "0-28 days",
      description: "Neonatal period (0-28 days of life)",
    },
    infant: {
      group: "infant",
      ageRange: "29 days - 1 year",
      description: "Infancy (29 days to 1 year)",
    },
    child: {
      group: "child",
      ageRange: "1-12 years",
      description: "Childhood (1-12 years)",
    },
    adolescent: {
      group: "adolescent",
      ageRange: "13-18 years",
      description: "Adolescence (13-18 years)",
    },
    adult: {
      group: "adult",
      ageRange: "18+ years",
      description: "Adulthood (18 years and older)",
    },
  };

/**
 * Determine pediatric age group from age in years
 */
export function getPediatricAgeGroup(ageYears: number): PediatricAgeGroup {
  if (ageYears < 0) {
    throw new Error("Age cannot be negative");
  }

  // Convert to days for neonate/infant classification
  const ageDays = ageYears * 365.25;

  if (ageDays <= 28) {
    return "neonate";
  } else if (ageDays <= 365.25) {
    return "infant";
  } else if (ageYears < 13) {
    return "child";
  } else if (ageYears < 18) {
    return "adolescent";
  } else {
    return "adult";
  }
}

/**
 * Get pediatric age group information
 */
export function getPediatricAgeInfo(ageYears: number): PediatricAgeInfo {
  const group = getPediatricAgeGroup(ageYears);
  return PEDIATRIC_AGE_GROUPS[group];
}

/**
 * Check if patient is pediatric (< 18 years)
 */
export function isPediatric(ageYears: number): boolean {
  return ageYears < 18;
}

/**
 * Validate pediatric dosing parameters
 */
export function validatePediatricDosing(
  ageYears: number,
  weightKg: number,
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (ageYears < 0) {
    errors.push("Age cannot be negative");
  }

  if (weightKg < 0) {
    errors.push("Weight cannot be negative");
  }

  const ageGroup = getPediatricAgeGroup(ageYears);

  // Neonates require special consideration
  if (ageGroup === "neonate") {
    if (weightKg < 0.5 || weightKg > 5) {
      warnings.push(
        "Neonate weight outside typical range (0.5-5 kg). Please verify.",
      );
    }
  }

  // Infants
  if (ageGroup === "infant") {
    if (weightKg < 2 || weightKg > 15) {
      warnings.push(
        "Infant weight outside typical range (2-15 kg). Please verify.",
      );
    }
  }

  // Children
  if (ageGroup === "child") {
    if (weightKg < 8 || weightKg > 50) {
      warnings.push(
        "Child weight outside typical range (8-50 kg). Please verify.",
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
