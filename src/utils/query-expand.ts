import { ORGANIZATIONS } from "./organization.js";
import { extractDrugTerms } from "./drug-names.js";

export type MeshConcept = {
  id: string;
  phrases: string[];
  synonyms: string[];
  mesh: string[];
  pubmedWildcards?: string[];
};

export const MESH_CONCEPTS: MeshConcept[] = [
  {
    id: "atrial-fibrillation",
    phrases: ["atrial fibrillation", "a-fib", "afib"],
    synonyms: ["AF"],
    mesh: ["Atrial Fibrillation"],
  },
  {
    id: "anticoagulation",
    phrases: [
      "anticoagulation",
      "anticoagulant",
      "anticoagulants",
      "antithrombotic",
    ],
    synonyms: ["DOAC", "NOAC"],
    mesh: ["Anticoagulants"],
    pubmedWildcards: ["anticoagul*"],
  },
  {
    id: "heart-failure",
    phrases: ["heart failure"],
    synonyms: ["HF"],
    mesh: ["Heart Failure"],
  },
  {
    id: "hfpef",
    phrases: [
      "heart failure with preserved ejection fraction",
      "preserved ejection fraction",
      "hfpef",
    ],
    synonyms: ["HFpEF"],
    mesh: ["Heart Failure"],
  },
  {
    id: "rsv",
    phrases: ["respiratory syncytial virus", "rsv"],
    synonyms: ["nirsevimab", "palivizumab", "beyfortus"],
    mesh: ["Respiratory Syncytial Virus Infections"],
  },
  {
    id: "nirsevimab",
    phrases: ["nirsevimab", "beyfortus"],
    synonyms: ["respiratory syncytial virus", "RSV", "palivizumab"],
    mesh: ["Respiratory Syncytial Virus Infections"],
  },
];

export type TrialLandmark = {
  acronyms: string[];
  ncts: string[];
  drugs: string[];
  requireAny: string[];
};

export const TRIAL_LANDMARKS: TrialLandmark[] = [
  {
    acronyms: ["STEP-HFpEF", "STEP HFpEF"],
    ncts: ["NCT04788511", "NCT04916470"],
    drugs: ["semaglutide", "ozempic", "wegovy"],
    requireAny: ["hfpef", "preserved"],
  },
];

export const INTERVENTION_HINTS = new Set([
  "immunotherapy",
  "immuno-therapy",
  "chemotherapy",
  "chemo",
  "radiotherapy",
  "radiation",
  "vaccine",
  "vaccination",
  "antibody",
  "antibodies",
  "inhibitor",
  "inhibitors",
  "transplant",
  "transplantation",
  "placebo",
  "steroid",
  "steroids",
  "checkpoint",
  "monoclonal",
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pubmedPhrase(term: string): string {
  return /\s/.test(term) || /[A-Z]/.test(term[0] || "") ? `"${term}"` : term;
}

function detectConcepts(query: string): MeshConcept[] {
  const lower = query.toLowerCase();
  const ranked = [...MESH_CONCEPTS].sort(
    (a, b) =>
      Math.max(...b.phrases.map((p) => p.length)) -
      Math.max(...a.phrases.map((p) => p.length)),
  );
  const matched: MeshConcept[] = [];
  let remaining = lower;
  for (const concept of ranked) {
    const hit = concept.phrases.find((phrase) =>
      new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(remaining),
    );
    if (!hit) continue;
    matched.push(concept);
    remaining = remaining.replace(
      new RegExp(`\\b${escapeRegex(hit)}\\b`, "i"),
      " ",
    );
  }
  return matched;
}

function detectSponsorAliases(query: string): string[] {
  const terms: string[] = [];
  for (const org of ORGANIZATIONS) {
    const hit = org.aliases.some((alias) => {
      const flags =
        alias === alias.toUpperCase() && /^[A-Z]+$/.test(alias) ? "" : "i";
      return new RegExp(`\\b${escapeRegex(alias)}\\b`, flags).test(query);
    });
    if (hit) {
      terms.push(org.displayName);
      if (org.id.length <= 5) {
        terms.push(org.id.toUpperCase());
      }
    }
  }
  return [...new Set(terms)];
}

function conceptPubMedClause(concept: MeshConcept): string {
  const parts = [
    ...concept.mesh.map((heading) => `"${heading}"[mh]`),
    ...concept.phrases.map((phrase) => `${pubmedPhrase(phrase)}[tiab]`),
    ...concept.synonyms.map((syn) => `${pubmedPhrase(syn)}[tiab]`),
    ...(concept.pubmedWildcards || []),
  ];
  return `(${[...new Set(parts)].join(" OR ")})`;
}

export function expandGuidelineQuery(query: string): {
  pubmedTerm: string;
  concepts: string[];
} {
  const trimmed = query.trim();
  const concepts = detectConcepts(trimmed);
  const sponsors = detectSponsorAliases(trimmed);

  if (concepts.length === 0 && sponsors.length === 0) {
    return { pubmedTerm: trimmed, concepts: [] };
  }

  const conceptClauses = concepts.map(conceptPubMedClause);
  let topic: string;
  if (conceptClauses.length === 0) {
    topic = trimmed;
  } else if (conceptClauses.length === 1) {
    topic = conceptClauses[0];
  } else {
    const [primary, ...rest] = conceptClauses;
    const restAnd = rest.join(" AND ");
    // Landmark disease guidelines (e.g. 2023 ACC/AHA AF) often omit the
    // subtopic word in the title. Keep a Practice Guideline branch on the
    // primary condition so they still rank.
    topic = `((${primary} AND ${restAnd}) OR (${primary} AND "Practice Guideline"[pt]))`;
  }

  if (sponsors.length > 0) {
    const sponsorClause = `(${sponsors
      .map((name) => pubmedPhrase(name))
      .join(" OR ")})`;
    topic = `(${topic} AND ${sponsorClause})`;
  }

  return {
    pubmedTerm: topic,
    concepts: concepts.map((concept) => concept.id),
  };
}

export function expandPediatricQuery(query: string): string {
  const trimmed = query.trim();
  const concepts = detectConcepts(trimmed);
  const rsvLike = concepts.filter(
    (concept) => concept.id === "rsv" || concept.id === "nirsevimab",
  );
  if (rsvLike.length === 0) {
    return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
  }
  const terms = new Set<string>();
  for (const concept of rsvLike) {
    for (const phrase of concept.phrases) terms.add(pubmedPhrase(phrase));
    for (const syn of concept.synonyms) terms.add(pubmedPhrase(syn));
  }
  return `(${[...terms].join(" OR ")})`;
}

export function matchingTrialLandmarks(query: string): TrialLandmark[] {
  const lower = query.toLowerCase();
  const drugs = extractDrugTerms(query);
  return TRIAL_LANDMARKS.filter((landmark) => {
    const drugHit =
      landmark.drugs.length === 0 ||
      landmark.drugs.some(
        (drug) => drugs.includes(drug) || lower.includes(drug.toLowerCase()),
      );
    const conditionHit = landmark.requireAny.some((token) =>
      lower.includes(token.toLowerCase()),
    );
    return drugHit && conditionHit;
  });
}

export function expandTrialConditionTerms(condition: string): string[] {
  const trimmed = condition.trim();
  if (!trimmed) return [];
  const concepts = detectConcepts(trimmed);
  const ids = new Set(concepts.map((concept) => concept.id));
  const focused = ids.has("hfpef")
    ? concepts.filter((concept) => concept.id !== "heart-failure")
    : concepts;
  const terms = new Set<string>();
  if (focused.length === 0) {
    terms.add(trimmed);
    return [...terms];
  }
  for (const concept of focused) {
    terms.add(concept.phrases[0]);
    for (const syn of concept.synonyms) {
      if (syn.length >= 3) terms.add(syn);
    }
  }
  return [...terms];
}
