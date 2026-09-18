/**
 * Evidence Grading for Medical Literature
 *
 * Tags PubMed articles with study type and evidence level based on
 * publication type metadata, title, and abstract keywords.
 *
 * Evidence hierarchy (highest → lowest):
 *   1. Systematic Review / Meta-Analysis
 *   2. Randomized Controlled Trial (RCT)
 *   3. Cohort Study
 *   4. Case-Control Study
 *   5. Case Report / Case Series
 *   6. Expert Opinion / Editorial / Narrative Review
 *   7. Unknown / Unclassified
 */

export type EvidenceLevel =
  | "Systematic Review / Meta-Analysis"
  | "Randomized Controlled Trial"
  | "Cohort Study"
  | "Case-Control Study"
  | "Case Report / Case Series"
  | "Expert Opinion / Editorial"
  | "Narrative Review"
  | "Study Protocol"
  | "Unknown";

export type EvidenceGrade = "I" | "II" | "III" | "IV" | "V" | "N/A";

export interface EvidenceTag {
  studyType: EvidenceLevel;
  grade: EvidenceGrade;
  /** Numeric sort priority (lower = higher quality) */
  sortPriority: number;
}

interface ClassificationRule {
  patterns: RegExp[];
  studyType: EvidenceLevel;
  grade: EvidenceGrade;
  priority: number;
}

/**
 * Classification rules ordered from most to least specific.
 * Patterns are checked against title + abstract.
 */
const RULES: ClassificationRule[] = [
  {
    studyType: "Study Protocol",
    grade: "N/A",
    priority: 0,
    patterns: [
      /\bstudy\s+protocol\b/i,
      /\bprotocol\s+for\s+a\b/i,
      /\btrial\s+protocol\b/i,
      /\bprotocol\s+paper\b/i,
    ],
  },
  {
    studyType: "Systematic Review / Meta-Analysis",
    grade: "I",
    priority: 1,
    patterns: [
      /\bmeta[\s-]?analysis\b/i,
      /\bsystematic\s+review\b/i,
      /\bcochrane\s+(review|database)\b/i,
      /\bprisma\b/i,
      /\bumbrella\s+review\b/i,
    ],
  },
  {
    studyType: "Randomized Controlled Trial",
    grade: "II",
    priority: 2,
    patterns: [
      /\brandomized\s+controlled\s+trial\b/i,
      /\brandomised\s+controlled\s+trial\b/i,
      /\brandom(?:ized|ised)\s+(?:clinical\s+)?trial\b/i,
      /\bthis\s+random(?:ized|ised)\b/i,
      /\bwe\s+(?:conducted|performed|undertook)\s+a\s+random(?:ized|ised)\b/i,
      /\bRCT\b/,
      /\bdouble[\s-]?blind\b/i,
      /\bplacebo[\s-]?controlled\b/i,
    ],
  },
  {
    studyType: "Cohort Study",
    grade: "III",
    priority: 3,
    patterns: [
      /\bcohort\s+stud/i,
      /\bprospective\s+stud/i,
      /\bretrospective\s+stud/i,
      /\blongitudinal\s+stud/i,
      /\bobservational\s+stud/i,
      /\bpopulation[\s-]?based\s+stud/i,
    ],
  },
  {
    studyType: "Case-Control Study",
    grade: "III",
    priority: 4,
    patterns: [
      /\bcase[\s-]?control\b/i,
      /\bmatched[\s-]?control\b/i,
      /\bnested\s+case[\s-]?control\b/i,
    ],
  },
  {
    studyType: "Case Report / Case Series",
    grade: "IV",
    priority: 5,
    patterns: [
      /\bcase\s+report\b/i,
      /\bcase\s+series\b/i,
      /\bcase\s+presentation\b/i,
      /\bclinical\s+case\b/i,
    ],
  },
  {
    studyType: "Expert Opinion / Editorial",
    grade: "V",
    priority: 6,
    patterns: [
      /\beditorial\b/i,
      /\bexpert\s+opinion\b/i,
      /\bexpert\s+consensus\b/i,
      /\bcommentary\b/i,
      /\bletter\s+to\s+the\s+editor\b/i,
      /\bperspective\b/i,
      /\bviewpoint\b/i,
    ],
  },
  {
    studyType: "Narrative Review",
    grade: "V",
    priority: 6,
    patterns: [
      /\breview\b(?!.*systematic)/i,
      /\bnarrative\s+review\b/i,
      /\bliterature\s+review\b/i,
      /\bscoping\s+review\b/i,
      /\bstate[\s-]?of[\s-]?the[\s-]?art\b/i,
    ],
  },
];

function matchesRule(rule: ClassificationRule, text: string): boolean {
  return rule.patterns.some((pattern) => pattern.test(text));
}

function titleIsNarrativeReview(title: string): boolean {
  if (
    /\bsystematic\s+review\b/i.test(title) ||
    /\bmeta[\s-]?analysis\b/i.test(title)
  ) {
    return false;
  }
  return (
    /:\s*a\s+review\b/i.test(title) ||
    /\bnarrative\s+review\b/i.test(title) ||
    /\bliterature\s+review\b/i.test(title) ||
    /\bscoping\s+review\b/i.test(title) ||
    /\bstate[\s-]?of[\s-]?the[\s-]?art\s+review\b/i.test(title) ||
    /\ba\s+review\s*$/i.test(title)
  );
}

/**
 * Classify a paper by study type and evidence grade.
 * Title review markers beat RCT wording in the abstract — JAMA reviews
 * routinely discuss randomized trials without being one.
 */
export function classifyEvidence(
  title: string,
  abstract?: string,
): EvidenceTag {
  const titleText = title || "";
  const searchText = `${titleText} ${abstract || ""}`;

  const protocol = RULES.find((rule) => rule.studyType === "Study Protocol");
  const systematic = RULES.find(
    (rule) => rule.studyType === "Systematic Review / Meta-Analysis",
  );
  if (protocol && matchesRule(protocol, searchText)) {
    return {
      studyType: protocol.studyType,
      grade: protocol.grade,
      sortPriority: protocol.priority,
    };
  }
  if (systematic && matchesRule(systematic, searchText)) {
    return {
      studyType: systematic.studyType,
      grade: systematic.grade,
      sortPriority: systematic.priority,
    };
  }
  if (titleIsNarrativeReview(titleText)) {
    return {
      studyType: "Narrative Review",
      grade: "V",
      sortPriority: 6,
    };
  }

  for (const rule of RULES) {
    if (
      rule.studyType === "Study Protocol" ||
      rule.studyType === "Systematic Review / Meta-Analysis"
    ) {
      continue;
    }
    if (matchesRule(rule, searchText)) {
      return {
        studyType: rule.studyType,
        grade: rule.grade,
        sortPriority: rule.priority,
      };
    }
  }

  return {
    studyType: "Unknown",
    grade: "N/A",
    sortPriority: 99,
  };
}

/**
 * Format evidence tag as a compact string for display
 */
export function formatEvidenceTag(tag: EvidenceTag): string {
  if (tag.studyType === "Unknown") return "";
  return `[${tag.studyType} • Grade ${tag.grade}]`;
}
