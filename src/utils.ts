import {
  DrugLabel,
  GoogleScholarArticle,
  PubMedArticle,
  RxNormDrug,
  WHOIndicator,
  ClinicalGuideline,
  GuidelineScore,
  PediatricGuideline,
  PediatricJournalArticle,
} from "./types.js";
import superagent from "superagent";
import {
  FDA_API_BASE,
  PUBMED_API_BASE,
  PMC_API_BASE,
  RXNAV_API_BASE,
  USER_AGENT,
  WHO_API_BASE,
  GUIDELINE_PUBLICATION_TYPES,
  GUIDELINE_KEYWORDS,
  GUIDELINE_SCORE_WEIGHTS,
  PEDIATRIC_JOURNALS,
  NCBI_API_KEY,
  MONID_API_KEY,
} from "./constants.js";
import {
  classifyAapResult,
  isAllowedAapUrl,
  normalizeAapUrl,
} from "./utils/aap-urls.js";
import {
  organizationFilterMatches,
  ORG_ALIASES,
  ORG_EXTRACTION_PATTERNS,
} from "./utils/organization.js";
import { parsePubMedXML, pmcRecordMatchesArticle } from "./utils/pubmed-xml.js";
import {
  formatCompactDate,
  isValidPmid,
  quoteMultiWordQuery,
  redactEmails,
  truncateWithNotice,
} from "./utils/text.js";
import {
  mapWhoDataValue,
  sortWhoValues,
  latestWhoSnapshot,
} from "./utils/who-gho.js";
import { cacheManager } from "./cache/manager.js";
import { getCacheConfig } from "./cache/config.js";
import { deduplicatePapers } from "./utils/deduplication.js";
import { searchSemanticScholar } from "./utils/semantic-scholar.js";
import { getRegisteredSourceHealth } from "./sources/health.js";
import {
  hasTinyFishKey,
  searchTinyFish,
} from "./sources/adapters/tinyfish-search.js";
import { TINYFISH_API_KEY } from "./constants.js";
import {
  classifyEvidence,
  formatEvidenceTag,
} from "./utils/evidence-grading.js";
import {
  resilientCall,
  CircuitOpenError,
  getAllCircuitStatus,
} from "./resilience/index.js";
import { getAllRateLimiterStatus } from "./resilience/rate-limiter.js";
import {
  FDASearchResponseSchema,
  PubMedSearchResponseSchema,
  WHOIndicatorResponseSchema,
  WHODataResponseSchema,
  RxNormDrugGroupSchema,
  safeValidate,
} from "./validation/schemas.js";
import { logger } from "./logger.js";

export { parsePubMedXML } from "./utils/pubmed-xml.js";
export { isValidPmid } from "./utils/text.js";

export function logSafetyWarnings() {
  // Add global safety warning
  console.error("🚨 MEDICAL MCP SERVER - SAFETY NOTICE:");
  console.error(
    "This server provides medical information for educational purposes only.",
  );
  console.error(
    "NEVER use this information as the sole basis for clinical decisions.",
  );
  console.error(
    "Always consult qualified healthcare professionals for patient care.",
  );
  console.error("");
  console.error("📊 DYNAMIC DATA SOURCE NOTICE:");
  console.error(
    "This system queries live medical databases (FDA, WHO, PubMed, RxNorm, AAP, Bright Futures)",
  );
  console.error(
    "NO hardcoded medical data is used - all information is retrieved dynamically",
  );
  console.error(
    "Data freshness depends on source database updates and API availability",
  );
  console.error(
    "Network connectivity required for all medical information retrieval",
  );
  console.error("");
  console.error("👶 PEDIATRIC SOURCES:");
  console.error(
    "Pediatric-specific information is available from AAP, Bright Futures, and pediatric journals",
  );
  console.error(
    "Pediatric drug information is filtered from FDA database for pediatric labeling",
  );
}

// Helper function to validate if a query looks like a drug name
function isValidDrugQuery(query: string): boolean {
  const trimmed = query.trim();
  // Reject queries that are just common words
  const commonWords = [
    "medication",
    "medicine",
    "drug",
    "pill",
    "tablet",
    "capsule",
    "injection",
    "dose",
    "dosage",
  ];

  const lowerQuery = trimmed.toLowerCase();
  // If query is only common words or very generic, likely not a real drug name
  if (commonWords.some((word) => lowerQuery === word)) {
    return false;
  }

  // Very short queries (1-2 chars) are likely not valid drug names
  if (trimmed.length < 3) {
    return false;
  }

  // Queries with fake-looking patterns
  if (/^[a-z]+-\d+$/.test(lowerQuery) || /\d{3,}/.test(trimmed)) {
    // Allow numeric suffixes but be cautious
    return trimmed.length >= 5;
  }

  return true;
}

export async function searchDrugs(
  query: string,
  limit: number = 10,
): Promise<DrugLabel[]> {
  // Validate query to prevent fuzzy matching on common words
  if (!isValidDrugQuery(query)) {
    return [];
  }

  // Try multiple search strategies with exact matching
  const searchQueries = [
    `openfda.brand_name:"${query}"`, // Exact phrase match for brand name
    `openfda.generic_name:"${query}"`, // Exact phrase match for generic name
    `openfda.substance_name:"${query}"`, // Exact phrase match for substance
    `openfda.brand_name:${query}`, // Partial match as fallback
  ];

  const allResults: DrugLabel[] = [];
  const seenNDCs = new Set<string>();

  for (const searchQuery of searchQueries) {
    try {
      const res = await resilientCall("FDA", async () =>
        superagent
          .get(`${FDA_API_BASE}/drug/label.json`)
          .query({
            search: searchQuery,
            limit: limit,
          })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 15_000, deadline: 30_000 }),
      );

      const validated = safeValidate(FDASearchResponseSchema, res.body, "FDA");
      const results = validated.results || [];
      for (const drug of results) {
        const ndc = drug.openfda?.product_ndc?.[0];
        if (ndc && !seenNDCs.has(ndc)) {
          seenNDCs.add(ndc);
          allResults.push(drug as DrugLabel);
          if (allResults.length >= limit) break;
        }
      }
      if (allResults.length >= limit) break;
    } catch (error) {
      // If circuit is open, stop trying more queries for this source
      if (error instanceof CircuitOpenError) break;
      // Continue to next search strategy
      continue;
    }
  }

  return allResults;
}

export async function getHealthIndicators(
  indicatorName: string,
  country?: string,
): Promise<WHOIndicator[]> {
  try {
    // First, find the indicator code by searching for the indicator name
    let filter = `contains(IndicatorName, '${indicatorName}')`;

    let res = await resilientCall("WHO", async () =>
      superagent
        .get(`${WHO_API_BASE}/Indicator`)
        .query({
          $filter: filter,
          $format: "json",
        })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );

    let validated = safeValidate(WHOIndicatorResponseSchema, res.body, "WHO");
    let indicators = validated.value || [];

    // If no results, try common variations
    if (indicators.length === 0) {
      const variations = getIndicatorVariations(indicatorName);
      for (const variation of variations) {
        filter = `contains(IndicatorName, '${variation}')`;

        try {
          res = await resilientCall("WHO", async () =>
            superagent
              .get(`${WHO_API_BASE}/Indicator`)
              .query({
                $filter: filter,
                $format: "json",
              })
              .set("User-Agent", USER_AGENT)
              .timeout({ response: 15_000, deadline: 30_000 }),
          );
        } catch (error) {
          if (error instanceof CircuitOpenError) break;
          continue;
        }

        validated = safeValidate(WHOIndicatorResponseSchema, res.body, "WHO");
        const variationResults = validated.value || [];
        if (variationResults.length > 0) {
          indicators = variationResults;
          break;
        }
      }
    }

    if (indicators.length === 0) {
      return [];
    }

    // Now fetch actual data for each indicator
    const results: WHOIndicator[] = [];

    for (const indicator of indicators.slice(0, 3)) {
      // Limit to first 3 indicators
      try {
        const indicatorCode = indicator.IndicatorCode;
        let dataFilter = "";
        if (country) {
          dataFilter = `SpatialDim eq '${country}'`;
        }

        const queryParams: Record<string, string | number> = {
          $format: "json",
          $top: 50,
        };

        if (dataFilter) {
          queryParams.$filter = dataFilter;
        }

        const dataRes = await superagent
          .get(`${WHO_API_BASE}/${indicatorCode}`)
          .query(queryParams)
          .set("User-Agent", USER_AGENT);

        const dataValidated = safeValidate(
          WHODataResponseSchema,
          dataRes.body,
          "WHO",
        );
        const dataValues = dataValidated.value || [];

        for (const item of dataValues) {
          const mapped = mapWhoDataValue(item, {
            IndicatorCode: indicator.IndicatorCode,
            IndicatorName: indicator.IndicatorName || "Unknown Indicator",
          });
          if (mapped) {
            results.push(mapped);
          }
        }
      } catch (dataError) {
        console.error(
          `Error fetching data for indicator ${indicator.IndicatorCode}:`,
          dataError,
        );
        // Still add the indicator definition even if data fetch fails
        results.push({
          IndicatorCode: indicator.IndicatorCode,
          IndicatorName: indicator.IndicatorName,
          SpatialDimType: "Country",
          SpatialDim: country || "Global",
          TimeDim: "Unknown",
          TimeDimType: "Year",
          DataSourceDim: "WHO",
          DataSourceType: "Official",
          Value: 0,
          NumericValue: 0,
          Low: 0,
          High: 0,
          Comments: "Data not available",
          Date: new Date().toISOString(),
        });
      }
    }

    return latestWhoSnapshot(sortWhoValues(results));
  } catch (error) {
    console.error("Error fetching WHO indicators:", error);
    return [];
  }
}

function getIndicatorVariations(indicatorName: string): string[] {
  const variations: string[] = [];
  const lower = indicatorName.toLowerCase();

  // Common medical indicator variations
  const commonMappings: { [key: string]: string[] } = {
    "maternal mortality": ["maternal", "mortality", "maternal death"],
    "infant mortality": [
      "infant",
      "mortality",
      "infant death",
      "child mortality",
    ],
    "life expectancy": ["life expectancy", "expectancy", "life"],
    "mortality rate": ["mortality", "death rate", "mortality rate"],
    "birth rate": ["birth", "fertility", "birth rate"],
    "death rate": ["death", "mortality", "death rate"],
    population: ["population", "demographics"],
    "health expenditure": ["health", "expenditure", "spending"],
    immunization: ["immunization", "vaccination", "vaccine"],
    malnutrition: ["malnutrition", "nutrition", "undernutrition"],
    diabetes: ["diabetes", "diabetic"],
    hypertension: ["hypertension", "blood pressure", "high blood pressure"],
    cancer: ["cancer", "neoplasm", "tumor"],
    hiv: ["hiv", "aids", "hiv/aids"],
    tuberculosis: ["tuberculosis", "tb"],
    malaria: ["malaria"],
    obesity: ["obesity", "overweight"],
  };

  // Check for exact matches first
  for (const [key, values] of Object.entries(commonMappings)) {
    if (lower.includes(key)) {
      variations.push(...values);
    }
  }

  // Add the original term and some basic variations
  variations.push(indicatorName);
  variations.push(lower);

  // Remove duplicates
  return [...new Set(variations)];
}

export async function searchRxNormDrugs(
  query: string,
  limit: number = 25,
): Promise<RxNormDrug[]> {
  try {
    const res = await resilientCall("RxNorm", async () =>
      superagent
        .get(`${RXNAV_API_BASE}/drugs.json`)
        .query({ name: query })
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );

    const validated = safeValidate(RxNormDrugGroupSchema, res.body, "RxNorm");
    const drugGroup = validated.drugGroup;
    if (!drugGroup || !drugGroup.conceptGroup) {
      return [];
    }

    // Find concept groups that have conceptProperties
    const results: RxNormDrug[] = [];
    for (const conceptGroup of drugGroup.conceptGroup) {
      if (
        conceptGroup.conceptProperties &&
        Array.isArray(conceptGroup.conceptProperties)
      ) {
        for (const concept of conceptGroup.conceptProperties) {
          // Transform the API response to match our RxNormDrug type
          results.push({
            rxcui: concept.rxcui || "",
            name: concept.name || "",
            synonym: concept.synonym
              ? Array.isArray(concept.synonym)
                ? concept.synonym
                : [concept.synonym]
              : [],
            tty: concept.tty || "",
            language: concept.language || "",
            suppress: concept.suppress || "",
            umlscui: concept.umlscui
              ? Array.isArray(concept.umlscui)
                ? concept.umlscui
                : [concept.umlscui]
              : [],
          });
        }
      }
    }

    const ttyOrder = ["IN", "PIN", "BN", "SCD", "SBD", "GPCK", "BPCK"];
    const isCombination = (name: string) => / \/ /.test(name);
    const strength = (name: string) => {
      const match = name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\b/i);
      return match ? parseFloat(match[1]) : Number.POSITIVE_INFINITY;
    };
    results.sort((a, b) => {
      const ttyA = ttyOrder.indexOf(a.tty);
      const ttyB = ttyOrder.indexOf(b.tty);
      const ttyCmp = (ttyA === -1 ? 99 : ttyA) - (ttyB === -1 ? 99 : ttyB);
      if (ttyCmp !== 0) return ttyCmp;
      const comboCmp =
        Number(isCombination(a.name)) - Number(isCombination(b.name));
      if (comboCmp !== 0) return comboCmp;
      const strengthCmp = strength(a.name) - strength(b.name);
      if (strengthCmp !== 0) return strengthCmp;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error searching RxNorm drugs:", error);
    return [];
  }
}

export function createMCPResponse(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: text,
      },
    ],
  };
}

/**
 * Helper to append cache metadata to response text
 */
function appendCacheInfo(text: string, metadata?: CacheMetadata): string {
  if (!metadata) return text;

  const cacheInfo = metadata.cached
    ? `\n\n*📦 Cached (${metadata.cacheAge}s old)*`
    : `\n\n*🔄 Fresh API response*`;

  return text + cacheInfo;
}

function formatArticleItem(article: any, index: number): string {
  let result = `${index + 1}. **${article.title}**\n`;

  // Evidence grading (if we have enough text)
  if (article.title) {
    const evidence = classifyEvidence(article.title, article.abstract);
    const evidenceStr = formatEvidenceTag(evidence);
    if (evidenceStr) {
      result += `   Evidence: ${evidenceStr}\n`;
    }
  }

  if (article.authors) {
    result += `   Authors: ${article.authors}\n`;
  }
  if (article.journal) {
    result += `   Journal: ${article.journal}\n`;
  }
  if (article.year) {
    result += `   Year: ${article.year}\n`;
  }
  if (article.citations) {
    result += `   Citations: ${article.citations}\n`;
  }
  if (article.url) {
    result += `   URL: ${article.url}\n`;
  }
  if (article.abstract) {
    result += `   Abstract: ${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? "..." : ""}\n`;
  }
  result += "\n";
  return result;
}

export function createErrorResponse(operation: string, error: any) {
  return createMCPResponse(
    `Error ${operation}: ${error.message || "Unknown error"}`,
  );
}

export function formatDrugSearchResults(
  drugs: any[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (drugs.length === 0) {
    // Check if query might be invalid
    const commonWords = [
      "medication",
      "medicine",
      "drug",
      "pill",
      "tablet",
      "capsule",
    ];
    if (commonWords.includes(query.toLowerCase().trim())) {
      return createMCPResponse(
        appendCacheInfo(
          `No drugs found for "${query}". This appears to be a generic term rather than a specific drug name. Please search for a specific medication name (e.g., "aspirin", "ibuprofen", "metformin").`,
          metadata,
        ),
      );
    }
    return createMCPResponse(
      appendCacheInfo(
        `No drugs found for "${query}". This medication may not be in the FDA database, or the name may be misspelled. Please verify the drug name and try again.`,
        metadata,
      ),
    );
  }

  let result = `**Drug Search Results for "${query}"**\n\n`;
  result += `Found ${drugs.length} drug(s)\n\n`;

  drugs.forEach((drug, index) => {
    result += `${index + 1}. **${drug.openfda.brand_name?.[0] || "Unknown Brand"}**\n`;
    result += `   Generic Name: ${drug.openfda.generic_name?.[0] || "Not specified"}\n`;
    result += `   Manufacturer: ${drug.openfda.manufacturer_name?.[0] || "Not specified"}\n`;
    result += `   Route: ${drug.openfda.route?.[0] || "Not specified"}\n`;
    result += `   Dosage Form: ${drug.openfda.dosage_form?.[0] || "Not specified"}\n`;

    if (drug.purpose && drug.purpose.length > 0) {
      result += `   Purpose: ${drug.purpose[0].substring(0, 200)}${drug.purpose[0].length > 200 ? "..." : ""}\n`;
    }

    result += `   Last Updated: ${drug.effective_time}\n\n`;
  });

  return createMCPResponse(appendCacheInfo(result, metadata));
}

// Helper function to categorize indicators by type and get explanation
function categorizeIndicator(indicatorName: string): {
  category: string;
  explanation?: string;
} {
  const name = indicatorName.toLowerCase();
  if (name.includes("life expectancy")) {
    if (name.includes("healthy")) {
      return {
        category: "Life Expectancy - Healthy",
        explanation:
          "Average number of years a person can expect to live in full health (without disability or illness)",
      };
    }
    if (name.includes("disability") || name.includes("hale")) {
      return {
        category: "Life Expectancy - Disability-Adjusted (HALE)",
        explanation:
          "Healthy Adjusted Life Expectancy - years lived in full health adjusted for time spent in poor health or with disability",
      };
    }
    if (name.includes("at birth")) {
      return {
        category: "Life Expectancy - At Birth",
        explanation:
          "Average number of years a newborn is expected to live, assuming current mortality patterns remain constant",
      };
    }
    return {
      category: "Life Expectancy",
      explanation: "Average number of years a person is expected to live",
    };
  }
  if (name.includes("mortality")) {
    if (name.includes("infant")) {
      return {
        category: "Mortality - Infant",
        explanation:
          "Death rate of infants under 1 year of age, typically expressed per 1,000 live births",
      };
    }
    if (name.includes("maternal")) {
      return {
        category: "Mortality - Maternal",
        explanation:
          "Death rate of women during pregnancy or within 42 days of termination of pregnancy",
      };
    }
    if (name.includes("child") || name.includes("under 5")) {
      return {
        category: "Mortality - Child",
        explanation:
          "Death rate of children under 5 years of age, typically expressed per 1,000 live births",
      };
    }
    return {
      category: "Mortality",
      explanation:
        "Death rate, typically expressed per 1,000 or 100,000 population",
    };
  }
  if (name.includes("prevalence")) {
    return {
      category: "Prevalence",
      explanation:
        "Proportion of population with a specific condition at a given time",
    };
  }
  if (name.includes("incidence")) {
    return {
      category: "Incidence",
      explanation:
        "Number of new cases of a condition occurring in a population during a specific time period",
    };
  }
  if (name.includes("rate")) {
    return {
      category: "Rate",
      explanation: "Frequency of occurrence per unit of population or time",
    };
  }
  return { category: "General" };
}

export function formatHealthIndicators(
  indicators: any[],
  indicator: string,
  country?: string,
  limit: number = 10,
  metadata?: CacheMetadata,
) {
  if (indicators.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No health indicators found for "${indicator}"${country ? ` in ${country}` : ""}. Try a different search term.`,
        metadata,
      ),
    );
  }

  // Group indicators by category
  const categorized = new Map<
    string,
    { indicators: typeof indicators; explanation?: string }
  >();
  indicators.forEach((ind) => {
    const { category, explanation } = categorizeIndicator(ind.IndicatorName);
    if (!categorized.has(category)) {
      categorized.set(category, { indicators: [], explanation });
    }
    categorized.get(category)!.indicators.push(ind);
  });

  let result = `**Health Statistics: ${indicator}**\n\n`;
  if (country) {
    result += `Country Filter: ${country}\n`;
  }
  result += `Found ${indicators.length} data point(s) across ${categorized.size} category/categories\n\n`;

  // Sort categories by priority (Life Expectancy first, then others)
  const categoryOrder = [
    "Life Expectancy - At Birth",
    "Life Expectancy - Healthy",
    "Life Expectancy - Disability-Adjusted",
    "Life Expectancy",
    "Mortality - Infant",
    "Mortality - Maternal",
    "Mortality - Child",
    "Mortality",
    "Prevalence",
    "Incidence",
    "Rate",
    "General",
  ];

  let remaining = limit;
  let itemIndex = 1;
  for (const category of categoryOrder) {
    if (!categorized.has(category) || remaining <= 0) continue;

    const categoryData = categorized.get(category)!;
    const categoryIndicators = categoryData.indicators;
    result += `## ${category}\n\n`;
    if (categoryData.explanation) {
      result += `*${categoryData.explanation}*\n\n`;
    }

    const sorted = [...categoryIndicators].sort((a, b) => {
      const yearA = parseInt(a.TimeDim, 10) || 0;
      const yearB = parseInt(b.TimeDim, 10) || 0;
      if (yearB !== yearA) return yearB - yearA;
      const sexOrder = (sex?: string) =>
        sex === "Both sexes"
          ? 0
          : sex === "Female"
            ? 1
            : sex === "Male"
              ? 2
              : 3;
      const sexCmp = sexOrder(a.Sex) - sexOrder(b.Sex);
      if (sexCmp !== 0) return sexCmp;
      return (b.NumericValue || 0) - (a.NumericValue || 0);
    });
    const sliced = sorted.slice(0, remaining);
    remaining -= sliced.length;

    sliced.forEach((ind) => {
      result += `${itemIndex}. **${ind.IndicatorName || indicator}**\n`;
      result += `   Country: ${ind.SpatialDim}\n`;
      result += `   Value: **${ind.Value}**\n`;
      if (ind.Sex) {
        result += `   Sex: ${ind.Sex}\n`;
      }
      if (ind.AgeGroup) {
        result += `   Age Group: ${ind.AgeGroup}\n`;
      }
      if (ind.Comments && ind.Comments !== "No additional context") {
        result += `   Context: ${ind.Comments}\n`;
      }
      if (ind.Low && ind.High && ind.Low !== 0 && ind.High !== 0) {
        result += `   Range: ${ind.Low} - ${ind.High}\n`;
      }
      result += `   Year: ${ind.TimeDim}\n`;
      result += `   Indicator Code: ${ind.IndicatorCode}\n\n`;
      itemIndex++;
    });
  }

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatPubMedArticles(
  articles: any[],
  query: string,
  metadata?: CacheMetadata,
  dedupStats?: {
    totalResults: number;
    uniqueResults: number;
    duplicatesRemoved: number;
  },
) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No medical articles found for "${query}". Try different search terms or check the spelling.`,
    );
  }

  let result = `**Medical Literature Search: "${query}"**\n\n`;
  if (dedupStats && dedupStats.duplicatesRemoved > 0) {
    result += `Found ${dedupStats.uniqueResults} unique article(s) from ${dedupStats.totalResults} total results (${dedupStats.duplicatesRemoved} duplicates removed)\n\n`;
  } else {
    result += `Found ${articles.length} article(s)\n\n`;
  }

  articles.forEach((article, index) => {
    // Evidence grading
    const evidence = classifyEvidence(article.title, article.abstract);
    const evidenceStr = formatEvidenceTag(evidence);

    result += `${index + 1}. **${article.title}**\n`;
    if (evidenceStr) {
      result += `   Evidence: ${evidenceStr}\n`;
    }
    result += `   Authors: ${article.authors.join(", ")}\n`;
    result += `   Journal: ${article.journal}\n`;
    result += `   Publication Date: ${article.publication_date}\n`;
    result += `   PMID: ${article.pmid}\n`;
    if (article.pmc_id) {
      result += `   PMC ID: ${article.pmc_id} (Full text available)\n`;
    }
    if (article.abstract) {
      result += `   Abstract: ${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? "..." : ""}\n`;
    }
    if (article.full_text) {
      result += `   **Full Text Available**\n`;
      result += `   Full Text (first 1000 chars): ${article.full_text.substring(0, 1000)}${article.full_text.length > 1000 ? "..." : ""}\n`;
      result += `   [Full text truncated for display. Use get-article-details for complete text.]\n`;
    }
    result += `   URL: https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/\n`;
    if (article.pmc_id) {
      result += `   Full Text: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${article.pmc_id}/\n`;
    }
    result += "\n";
  });

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatGoogleScholarArticles(
  articles: any[],
  query: string,
  metadata?: CacheMetadata,
  dedupStats?: {
    totalResults: number;
    uniqueResults: number;
    duplicatesRemoved: number;
  },
) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No academic articles found for "${query}". This could be due to no results matching your query, rate limiting, or network issues.`,
    );
  }

  let result = `**Academic Research Search: "${query}"**\n\n`;
  if (dedupStats && dedupStats.duplicatesRemoved > 0) {
    result += `Found ${dedupStats.uniqueResults} unique article(s) from ${dedupStats.totalResults} total results (${dedupStats.duplicatesRemoved} duplicates removed)\n\n`;
  } else {
    result += `Found ${articles.length} article(s)\n\n`;
  }

  articles.forEach((article, index) => {
    result += formatArticleItem(article, index);
  });

  return createMCPResponse(appendCacheInfo(result, metadata));
}

function addDataNote(result: string) {
  result += `• No hardcoded data - all results retrieved in real-time\n\n`;
  result += `**ALWAYS:**\n`;
  result += `• Verify information through multiple sources\n`;
  result += `• Consult qualified healthcare professionals\n`;
  result += `• Consider publication dates and evidence quality\n`;
  result += `• Follow established clinical guidelines\n\n`;
  result += `**NEVER rely solely on this information for clinical decisions.**`;

  return result;
}

export function formatMedicalJournalsSearch(
  articles: any[],
  query: string,
  metadata?: CacheMetadata,
  dedupStats?: {
    totalResults: number;
    uniqueResults: number;
    duplicatesRemoved: number;
  },
) {
  if (articles.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No articles found for "${query}" in top medical journals. This could be due to no results matching your query, journal-specific search limitations, or network connectivity issues.`,
        metadata,
      ),
    );
  }

  let result = `**Top Medical Journals Search: "${query}"**\n\n`;
  if (dedupStats && dedupStats.duplicatesRemoved > 0) {
    result += `Found ${dedupStats.uniqueResults} unique article(s) from ${dedupStats.totalResults} total results (${dedupStats.duplicatesRemoved} duplicates removed) from top medical journals\n\n`;
  } else {
    result += `Found ${articles.length} article(s) from top medical journals\n\n`;
  }

  articles.forEach((article, index) => {
    result += formatArticleItem(article, index);
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `This search retrieves information from top medical journals dynamically.\n\n`;
  result += `**DYNAMIC DATA SOURCES:**\n`;
  result += `• New England Journal of Medicine (NEJM)\n`;
  result += `• Journal of the American Medical Association (JAMA)\n`;
  result += `• The Lancet\n`;
  result += `• British Medical Journal (BMJ)\n`;
  result += `• Nature Medicine\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatArticleDetails(
  article: any,
  pmid: string,
  metadata?: CacheMetadata,
) {
  if (!article) {
    return createMCPResponse(
      appendCacheInfo(`No article found with PMID: ${pmid}`, metadata),
    );
  }

  let result = `**Article Details for PMID: ${pmid}**\n\n`;
  result += `**Title:** ${article.title}\n\n`;

  if (article.authors && article.authors.length > 0) {
    result += `**Authors:** ${article.authors.join(", ")}\n\n`;
  }

  result += `**Journal:** ${article.journal}\n`;
  result += `**Publication Date:** ${article.publication_date}\n`;

  if (article.doi) {
    result += `**DOI:** ${article.doi}\n`;
  }

  if (article.pmc_id) {
    result += `**PMC ID:** ${article.pmc_id}\n`;
    result += `**Full Text Available:** Yes\n`;
    result += `**Full Text URL:** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${article.pmc_id}/\n\n`;
  }

  result += `\n**Abstract:**\n${article.abstract}\n\n`;

  if (article.full_text) {
    const redacted = redactEmails(article.full_text);
    const { text, truncated } = truncateWithNotice(redacted, 8000);
    result += `**Full Text:**\n${text}\n\n`;
    if (truncated) {
      result += `**Note:** Full text truncated at 8000 characters. Visit the PMC URL above for the complete article.\n\n`;
    }
  } else if (article.pmc_id) {
    result += `**Note:** Full text is available but could not be automatically retrieved. `;
    result += `Please visit the PMC URL above to access the complete article.\n\n`;
  } else {
    result += `**Note:** Full text is not available in PubMed Central. `;
    result += `You may need institutional access or subscription to view the complete article.\n\n`;
  }

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatRxNormDrugs(
  drugs: any[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (drugs.length === 0) {
    return createMCPResponse(
      `No drugs found in RxNorm database for "${query}". Try a different search term.`,
    );
  }

  let result = `**RxNorm Drug Search: "${query}"**\n\n`;
  result += `Found ${drugs.length} drug(s)\n\n`;

  drugs.forEach((drug, index) => {
    result += `${index + 1}. **${drug.name}**\n`;
    result += `   RxCUI: ${drug.rxcui}\n`;
    result += `   Term Type: ${drug.tty}\n`;
    result += `   Language: ${drug.language}\n`;
    if (drug.synonym && drug.synonym.length > 0) {
      result += `   Synonyms: ${drug.synonym.slice(0, 3).join(", ")}${drug.synonym.length > 3 ? "..." : ""}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatClinicalGuidelines(
  guidelines: any[],
  query: string,
  organization?: string,
  metadata?: CacheMetadata,
) {
  if (guidelines.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No clinical guidelines found for "${query}"${organization ? ` from ${organization}` : ""}. Try a different search term or check if the condition has established guidelines.`,
        metadata,
      ),
    );
  }

  let result = `**Clinical Guidelines Search: "${query}"**\n\n`;
  if (organization) {
    result += `Organization Filter: ${organization}\n`;
  }
  result += `Found ${guidelines.length} guideline(s)\n\n`;

  guidelines.forEach((guideline, index) => {
    result += `${index + 1}. **${guideline.title}**\n`;
    result += `   Organization: ${guideline.organization}\n`;
    result += `   Year: ${guideline.year}\n`;
    result += `   Category: ${guideline.category}\n`;
    result += `   Evidence Level: ${guideline.evidence_level}\n`;
    if (guideline.description) {
      result += `   Description: ${guideline.description}\n`;
    }
    result += `   URL: ${guideline.url}\n\n`;
  });

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatBrightFuturesGuidelines(
  guidelines: PediatricGuideline[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (guidelines.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No Bright Futures guidelines found for "${query}". Try a different search term.`,
        metadata,
      ),
    );
  }

  let result = `**Bright Futures Guidelines: "${query}"**\n\n`;
  result += `Found ${guidelines.length} guideline(s)\n\n`;

  guidelines.forEach((guideline, index) => {
    result += `${index + 1}. **${guideline.title}**\n`;
    result += `   Organization: ${guideline.organization}\n`;
    if (guideline.age_group) {
      result += `   Age Group: ${guideline.age_group}\n`;
    }
    if (guideline.category) {
      result += `   Category: ${guideline.category}\n`;
    }
    if (guideline.description) {
      result += `   Description: ${guideline.description}\n`;
    }
    result += `   URL: ${guideline.url}\n\n`;
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `Bright Futures guidelines are retrieved dynamically from the AAP website.\n\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatAAPPolicyStatements(
  guidelines: PediatricGuideline[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (guidelines.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No AAP policy statements found for "${query}". Try a different search term.`,
        metadata,
      ),
    );
  }

  let result = `**AAP Policy Statements: "${query}"**\n\n`;
  result += `Found ${guidelines.length} policy statement(s)\n\n`;

  guidelines.forEach((guideline, index) => {
    result += `${index + 1}. **${guideline.title}**\n`;
    result += `   Organization: ${guideline.organization}\n`;
    if (guideline.year) {
      result += `   Year: ${guideline.year}\n`;
    }
    if (guideline.category) {
      result += `   Category: ${guideline.category}\n`;
    }
    if (guideline.description) {
      result += `   Description: ${guideline.description}\n`;
    }
    result += `   URL: ${guideline.url}\n\n`;
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `AAP policy statements are retrieved dynamically from the AAP publications website.\n\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatPediatricJournals(
  articles: PediatricJournalArticle[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (articles.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No pediatric journal articles found for "${query}". Try a different search term.`,
        metadata,
      ),
    );
  }

  let result = `**Pediatric Journal Articles: "${query}"**\n\n`;
  result += `Found ${articles.length} article(s) from major pediatric journals\n\n`;

  articles.forEach((article, index) => {
    result += `${index + 1}. **${article.title}**\n`;
    result += `   Authors: ${article.authors.join(", ")}\n`;
    result += `   Journal: ${article.journal}\n`;
    result += `   Publication Date: ${article.publication_date}\n`;
    result += `   PMID: ${article.pmid}\n`;
    if (article.pmc_id) {
      result += `   PMC ID: ${article.pmc_id} (Full text available)\n`;
    }
    if (article.abstract) {
      result += `   Abstract: ${article.abstract.substring(0, 300)}${article.abstract.length > 300 ? "..." : ""}\n`;
    }
    result += `   URL: https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/\n`;
    if (article.pmc_id) {
      result += `   Full Text: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${article.pmc_id}/\n`;
    }
    result += "\n";
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `Pediatric journal articles are retrieved dynamically from PubMed.\n\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatPediatricDrugs(
  drugs: DrugLabel[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (drugs.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No pediatric drugs found for "${query}". This may indicate the drug is not approved for pediatric use or lacks pediatric labeling information.`,
        metadata,
      ),
    );
  }

  let result = `**Pediatric Drug Search: "${query}"**\n\n`;
  result += `Found ${drugs.length} drug(s) with pediatric labeling\n\n`;

  drugs.forEach((drug, index) => {
    result += `${index + 1}. `;
    if (drug.openfda?.brand_name && drug.openfda.brand_name.length > 0) {
      result += `**${drug.openfda.brand_name[0]}**`;
      if (drug.openfda?.generic_name && drug.openfda.generic_name.length > 0) {
        result += ` (${drug.openfda.generic_name[0]})`;
      }
    } else if (
      drug.openfda?.generic_name &&
      drug.openfda.generic_name.length > 0
    ) {
      result += `**${drug.openfda.generic_name[0]}**`;
    } else {
      result += `**Drug ${index + 1}**`;
    }
    result += `\n`;

    if (drug.purpose && drug.purpose.length > 0) {
      result += `   Purpose: ${drug.purpose.join(", ")}\n`;
    }

    if (
      drug.dosage_and_administration &&
      drug.dosage_and_administration.length > 0
    ) {
      const dosage = drug.dosage_and_administration.join(" ");
      // Extract pediatric-specific dosing if available
      const pediatricDosing = dosage.match(
        /(?:pediatric|child|infant|neonatal)[^.]*(?:\.|$)/i,
      );
      if (pediatricDosing) {
        result += `   Pediatric Dosing: ${pediatricDosing[0].substring(0, 200)}...\n`;
      }
    }

    if (drug.warnings && drug.warnings.length > 0) {
      const warnings = drug.warnings.join(" ");
      const pediatricWarnings = warnings.match(
        /(?:pediatric|child|infant|neonatal)[^.]*(?:\.|$)/i,
      );
      if (pediatricWarnings) {
        result += `   Pediatric Warnings: ${pediatricWarnings[0].substring(0, 200)}...\n`;
      }
    }

    const manufacturer = drug.openfda?.manufacturer_name?.[0];
    const ndc = drug.openfda?.product_ndc?.[0];
    const strength = drug.openfda?.substance_name?.[0];
    if (manufacturer) {
      result += `   Manufacturer: ${manufacturer}\n`;
    }
    if (ndc) {
      result += `   NDC: ${ndc}\n`;
      result += `   URL: https://dailymed.nlm.nih.gov/dailymed/search.cfm?searchterm=${encodeURIComponent(ndc)}\n`;
    }
    if (strength) {
      result += `   Substance: ${strength}\n`;
    }
    if (drug.openfda?.dosage_form?.[0]) {
      result += `   Form: ${drug.openfda.dosage_form[0]}\n`;
    }
    const effective =
      formatCompactDate(drug.effective_time) || drug.effective_time;
    result += `   Effective Time: ${effective}\n`;
    result += "\n";
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `Pediatric drug information is retrieved dynamically from FDA database.\n\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

export function formatAAPGuidelines(
  guidelines: PediatricGuideline[],
  query: string,
  metadata?: CacheMetadata,
) {
  if (guidelines.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        `No AAP guidelines found for "${query}". Try a different search term.`,
        metadata,
      ),
    );
  }

  // Separate by source
  const brightFutures = guidelines.filter((g) => g.source === "bright-futures");
  const aapPolicy = guidelines.filter((g) => g.source === "aap-policy");

  let result = `**AAP Guidelines Search: "${query}"**\n\n`;
  result += `Found ${guidelines.length} guideline(s) total\n`;
  if (brightFutures.length > 0) {
    result += `- ${brightFutures.length} from Bright Futures\n`;
  }
  if (aapPolicy.length > 0) {
    result += `- ${aapPolicy.length} from AAP Policy Statements\n`;
  }
  result += "\n";

  guidelines.forEach((guideline, index) => {
    result += `${index + 1}. **${guideline.title}**\n`;
    result += `   Source: ${guideline.source === "bright-futures" ? "Bright Futures" : "AAP"}\n`;
    result += `   Organization: ${guideline.organization}\n`;
    if (guideline.year) {
      result += `   Year: ${guideline.year}\n`;
    }
    if (guideline.age_group) {
      result += `   Age Group: ${guideline.age_group}\n`;
    }
    if (guideline.category) {
      result += `   Category: ${guideline.category}\n`;
    }
    if (guideline.description) {
      result += `   Description: ${guideline.description}\n`;
    }
    result += `   URL: ${guideline.url}\n\n`;
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `AAP guidelines are retrieved dynamically from Bright Futures and AAP publications websites.\n\n`;
  result = addDataNote(result);

  return createMCPResponse(appendCacheInfo(result, metadata));
}

/**
 * Extract DOI from various text sources
 * @param textSources Array of text strings to search for DOI
 * @returns DOI string if found, empty string otherwise
 */
function extractDOI(textSources: string[]): string {
  const doiPatterns = [
    /doi[:\s]+(10\.\d+\/[^\s]+)/i,
    /doi[:\s]+([^\s]+)/i,
    /(10\.\d+\/[^\s]+)/,
  ];

  for (const text of textSources) {
    for (const pattern of doiPatterns) {
      const match = text.match(pattern);
      if (match) {
        let doi = match[1].trim();
        // Validate DOI format (starts with 10.)
        if (doi.startsWith("10.")) {
          // Clean up DOI (remove trailing punctuation)
          doi = doi.replace(/[.,;:!?)\]]+$/, "");
          return doi;
        }
      }
    }
  }

  return "";
}

function pubmedToScholarArticles(
  articles: PubMedArticle[],
): GoogleScholarArticle[] {
  return articles.map((article) => ({
    title: article.title,
    authors: article.authors.join(", "),
    abstract: article.abstract,
    journal: article.journal,
    year: article.publication_date.split("-")[0],
    citations: "",
    url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    doi: article.doi,
  }));
}

export async function searchGoogleScholar(
  query: string,
): Promise<GoogleScholarArticle[]> {
  if (hasTinyFishKey()) {
    logger.info(
      "GoogleScholar",
      `Using TinyFish research_paper search for: ${query}`,
    );
    const tinyFish = await searchTinyFish(query, {
      limit: 10,
      extra: {
        domainType: "research_paper",
        purpose: "Find peer-reviewed medical and scientific papers",
      },
    });
    if (tinyFish.length > 0) {
      return tinyFish.map((item) => ({
        title: item.title,
        authors: item.authors,
        abstract: item.abstract,
        journal: item.journal,
        year: item.year,
        citations: item.citations,
        url: item.url,
        pdf_url: item.pdfUrl,
        doi: item.doi,
      }));
    }
    logger.warn(
      "GoogleScholar",
      "TinyFish returned no papers; falling back to Semantic Scholar.",
    );
  } else {
    logger.info(
      "GoogleScholar",
      "No Monid/TinyFish key; using Semantic Scholar",
    );
  }

  const semantic = await searchSemanticScholar(query, 10);
  if (semantic.length > 0) {
    return semantic;
  }

  logger.warn(
    "GoogleScholar",
    "Semantic Scholar returned no papers; falling back to PubMed.",
  );
  const pubmed = await searchPubMedArticles(query, 10);
  return pubmedToScholarArticles(pubmed);
}

export async function searchMedicalJournals(
  query: string,
): Promise<GoogleScholarArticle[]> {
  logger.info("MedicalJournals", `Searching medical journals for: ${query}`);
  const phrase = quoteMultiWordQuery(query);
  const journals = [
    { name: "NEJM", term: '"N Engl J Med"[Journal]' },
    { name: "JAMA", term: '"JAMA"[Journal]' },
    { name: "Lancet", term: '"Lancet"[Journal]' },
    { name: "BMJ", term: '"BMJ"[Journal]' },
    { name: "Nature Medicine", term: '"Nat Med"[Journal]' },
  ];

  const journalSearches = await Promise.allSettled(
    journals.map((journal) =>
      searchPubMed(`${phrase} AND ${journal.term}`, 5).then((articles) =>
        pubmedToScholarArticles(articles).map((article) => ({
          ...article,
          journal: article.journal || journal.name,
        })),
      ),
    ),
  );

  const results: GoogleScholarArticle[] = [];
  journalSearches.forEach((search) => {
    if (search.status === "fulfilled" && search.value) {
      results.push(...search.value);
    }
  });

  const dedupResult = deduplicatePapers(results);
  return dedupResult.papers.slice(0, 15) as GoogleScholarArticle[];
}

async function fetchFullTextFromPMC(
  pmc_id: string,
  expected?: { pmid?: string; doi?: string },
): Promise<string | null> {
  try {
    const pmcXmlUrl = `${PMC_API_BASE}/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmc_id}&metadataPrefix=pmc`;
    const xmlResponse = await superagent
      .get(pmcXmlUrl)
      .set("User-Agent", USER_AGENT)
      .timeout(30000);

    const xmlText = xmlResponse.text;
    if (expected && (expected.pmid || expected.doi)) {
      if (!pmcRecordMatchesArticle(xmlText, expected)) {
        logger.warn(
          "PMC",
          `PMC${pmc_id} does not match PMID ${expected.pmid || ""} / DOI ${expected.doi || ""} — not attaching full text`,
        );
        return null;
      }
    }
    const bodyMatches = xmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/gi);
    if (bodyMatches && bodyMatches.length > 0) {
      let fullText = "";
      for (const body of bodyMatches) {
        const extracted = body
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (extracted.length > 100) {
          fullText += extracted + "\n\n";
        }
      }
      if (fullText.trim().length > 500) {
        return fullText.trim();
      }
    }
  } catch (xmlError) {
    logger.warn("PMC", `XML method failed for ${pmc_id}; trying Monid fetch`);
  }

  return null;
}

export async function searchPubMedArticles(
  query: string,
  maxResults: number = 10,
): Promise<PubMedArticle[]> {
  try {
    const phrase = quoteMultiWordQuery(query);
    const anded = query.trim().split(/\s+/).filter(Boolean).join(" AND ");
    const generalTerm =
      phrase === anded || !/\s/.test(query.trim())
        ? query.trim()
        : `(${phrase}) OR (${anded})`;
    const evidenceTerm = `(${generalTerm}) AND ("systematic review"[pt] OR "meta-analysis"[pt] OR "randomized controlled trial"[pt] OR "clinical trial, phase iii"[pt])`;

    const [highEvidence, general] = await Promise.all([
      searchPubMed(evidenceTerm, maxResults),
      searchPubMed(generalTerm, maxResults),
    ]);

    const seen = new Set<string>();
    const merged: PubMedArticle[] = [];
    for (const article of [...highEvidence, ...general]) {
      if (!article.pmid || seen.has(article.pmid)) continue;
      seen.add(article.pmid);
      merged.push(article);
    }

    merged.sort((a, b) => {
      const evidenceA = classifyEvidence(a.title, a.abstract);
      const evidenceB = classifyEvidence(b.title, b.abstract);
      if (evidenceA.sortPriority !== evidenceB.sortPriority) {
        return evidenceA.sortPriority - evidenceB.sortPriority;
      }
      return (b.publication_date || "").localeCompare(a.publication_date || "");
    });

    return merged.slice(0, maxResults);
  } catch (error) {
    console.error("Error searching PubMed:", error);
    return [];
  }
}

export async function getPubMedArticleByPMID(
  pmid: string,
): Promise<PubMedArticle | null> {
  if (!isValidPmid(pmid)) {
    return null;
  }
  try {
    const fetchParams: Record<string, any> = {
      db: "pubmed",
      id: pmid.trim(),
      retmode: "xml",
    };
    if (NCBI_API_KEY) {
      fetchParams.api_key = NCBI_API_KEY;
    }

    const fetchRes = await resilientCall("PubMed", async () =>
      superagent
        .get(`${PUBMED_API_BASE}/efetch.fcgi`)
        .query(fetchParams)
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );

    const articles = parsePubMedXML(fetchRes.text);
    const article = articles[0] || null;

    if (article && article.pmc_id) {
      try {
        const fullText = await fetchFullTextFromPMC(article.pmc_id, {
          pmid: article.pmid,
          doi: article.doi,
        });
        if (fullText) {
          article.full_text = fullText;
        }
      } catch (error) {
        console.error(`Error fetching full text for PMID ${pmid}:`, error);
      }
    }

    return article;
  } catch (error) {
    console.error("Error fetching article by PMID:", error);
    return null;
  }
}

// Helper function to calculate guideline score for an article
function calculateGuidelineScore(
  article: PubMedArticle,
  hasPublicationType: boolean,
): GuidelineScore {
  const title = article.title.toLowerCase();
  const abstract = (article.abstract || "").toLowerCase();

  const score: GuidelineScore = {
    publicationType: 0,
    titleKeywords: 0,
    journalReputation: 0,
    authorAffiliation: 0,
    abstractKeywords: 0,
    meshTerms: 0,
    total: 0,
  };

  // Publication type score
  if (hasPublicationType) {
    score.publicationType = GUIDELINE_SCORE_WEIGHTS.PUBLICATION_TYPE;
  }

  // Title keywords score
  for (const keyword of GUIDELINE_KEYWORDS) {
    if (title.includes(keyword.toLowerCase())) {
      score.titleKeywords = GUIDELINE_SCORE_WEIGHTS.TITLE_KEYWORD;
      break; // Only count once
    }
  }

  // Abstract keywords score (can be partial)
  for (const keyword of GUIDELINE_KEYWORDS) {
    if (abstract.includes(keyword.toLowerCase())) {
      score.abstractKeywords += GUIDELINE_SCORE_WEIGHTS.ABSTRACT_KEYWORD;
    }
  }
  score.abstractKeywords = Math.min(
    score.abstractKeywords,
    GUIDELINE_SCORE_WEIGHTS.ABSTRACT_KEYWORD * 2,
  ); // Cap at 2 * weight

  // Journal reputation (recognize known guideline-publishing journals)
  const knownGuidelineJournals = [
    "journal of the american",
    "new england journal",
    "lancet",
    "bmj",
    "annals of",
    "guidelines",
    "recommendations",
  ];
  const journal = article.journal.toLowerCase();
  for (const knownJournal of knownGuidelineJournals) {
    if (journal.includes(knownJournal)) {
      score.journalReputation = GUIDELINE_SCORE_WEIGHTS.JOURNAL_REPUTATION;
      break;
    }
  }

  // Author affiliation (organization pattern matching)
  // Note: We'll check affiliations when extracting organization
  // This is a placeholder that will be updated during organization extraction
  score.authorAffiliation = 0;

  // MeSH terms (would require additional API call to check, simplified here)
  // For now, assume 0 unless we add MeSH term checking
  score.meshTerms = 0;

  score.total =
    score.publicationType +
    score.titleKeywords +
    score.journalReputation +
    score.authorAffiliation +
    score.abstractKeywords +
    score.meshTerms;

  return score;
}

const GUIDELINE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "for",
  "in",
  "of",
  "on",
  "to",
  "with",
  "adult",
  "adults",
  "clinical",
  "practice",
  "guideline",
  "guidelines",
  "management",
  "treatment",
  "update",
  "updated",
  "recommendation",
  "recommendations",
]);

const GUIDELINE_SYNONYMS: Record<string, string[]> = {
  hypertension: [
    "hypertension",
    "hypertensive",
    "blood pressure",
    "high blood pressure",
  ],
  diabetes: ["diabetes", "diabetic", "glucose"],
  asthma: ["asthma", "asthmatic"],
  copd: ["copd", "chronic obstructive"],
};

function significantGuidelineTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\w-]/g, ""))
    .filter((token) => token.length > 2 && !GUIDELINE_STOPWORDS.has(token));
}

function guidelineSearchTerm(query: string): string {
  const tokens = significantGuidelineTokens(query);
  if (tokens.length === 0) {
    return quoteMultiWordQuery(query);
  }
  const parts = tokens.flatMap((token) => GUIDELINE_SYNONYMS[token] || [token]);
  const unique = [...new Set(parts)];
  return `(${unique
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" OR ")})`;
}

function guidelineTitleMatchesQuery(query: string, title: string): boolean {
  const tokens = significantGuidelineTokens(query);
  if (tokens.length === 0) return true;
  const haystack = title.toLowerCase();
  return tokens.some((token) =>
    (GUIDELINE_SYNONYMS[token] || [token]).some((alias) =>
      haystack.includes(alias),
    ),
  );
}

const ORG_DISPLAY_NAMES: Record<string, string> = {
  aap: "American Academy of Pediatrics",
  who: "World Health Organization",
  cdc: "Centers for Disease Control and Prevention",
  aha: "American Heart Association",
  acc: "American College of Cardiology",
  ada: "American Diabetes Association",
  acp: "American College of Physicians",
  ish: "International Society of Hypertension",
  esc: "European Society of Cardiology",
  nice: "National Institute for Health and Care Excellence",
};

// Helper function to extract organization dynamically using patterns
function extractOrganization(article: PubMedArticle): string {
  const title = article.title || "";
  const titleLower = title.toLowerCase();
  const matched = Object.entries(ORG_ALIASES)
    .filter(
      ([abbr, aliases]) =>
        aliases.some((alias) => titleLower.includes(alias)) ||
        new RegExp(`\\b${abbr}\\b`, "i").test(title),
    )
    .map(([abbr]) => ORG_DISPLAY_NAMES[abbr] || abbr.toUpperCase());
  if (matched.length > 0) {
    return [...new Set(matched)].join(" / ");
  }

  for (const pattern of ORG_EXTRACTION_PATTERNS) {
    pattern.lastIndex = 0;
    const match = title.match(pattern) || article.abstract?.match(pattern);
    if (match && match[0] && match[0].length > 3) {
      return match[0];
    }
  }

  return "Unknown Organization";
}

// Helper function to search PubMed with a query
async function searchPubMed(
  query: string,
  maxResults: number = 20,
): Promise<PubMedArticle[]> {
  try {
    const searchParams: Record<string, any> = {
      db: "pubmed",
      term: query,
      retmode: "json",
      retmax: maxResults,
      sort: "relevance",
    };
    if (NCBI_API_KEY) {
      searchParams.api_key = NCBI_API_KEY;
    }

    const searchRes = await resilientCall("PubMed", async () =>
      superagent
        .get(`${PUBMED_API_BASE}/esearch.fcgi`)
        .query(searchParams)
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 15_000, deadline: 30_000 }),
    );

    const validated = safeValidate(
      PubMedSearchResponseSchema,
      searchRes.body,
      "PubMed",
    );
    const idList = validated.esearchresult?.idlist || [];
    if (idList.length === 0) return [];

    // Fetch article details
    const fetchParams: Record<string, any> = {
      db: "pubmed",
      id: idList.join(","),
      retmode: "xml",
    };
    if (NCBI_API_KEY) {
      fetchParams.api_key = NCBI_API_KEY;
    }

    const fetchRes = await resilientCall("PubMed", async () =>
      superagent
        .get(`${PUBMED_API_BASE}/efetch.fcgi`)
        .query(fetchParams)
        .set("User-Agent", USER_AGENT)
        .timeout({ response: 20_000, deadline: 45_000 }),
    );

    return parsePubMedXML(fetchRes.text);
  } catch (error) {
    logger.error("PubMed", `Error searching PubMed with query: ${query}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function searchClinicalGuidelines(
  query: string,
  organization?: string,
): Promise<ClinicalGuideline[]> {
  try {
    const allArticles: Array<{
      article: PubMedArticle;
      score: GuidelineScore;
      hasPublicationType: boolean;
    }> = [];

    // Layer 1: Publication Type Filter (High Precision)
    const topicTerm = guidelineSearchTerm(query);
    const pubTypeQuery = `${topicTerm} AND (${GUIDELINE_PUBLICATION_TYPES.join(" OR ")})`;
    const layer1Articles = await searchPubMed(pubTypeQuery, 20);

    for (const article of layer1Articles) {
      if (!guidelineTitleMatchesQuery(query, article.title)) continue;
      const score = calculateGuidelineScore(article, true);
      allArticles.push({ article, score, hasPublicationType: true });
    }

    // Layer 2: Semantic Search (Broader Coverage)
    // Only if Layer 1 returned fewer than threshold results
    const LAYER_THRESHOLD = 5;
    if (allArticles.length < LAYER_THRESHOLD) {
      const semanticKeywords = GUIDELINE_KEYWORDS.slice(0, 5)
        .map((k) => `${k}[tiab]`)
        .join(" OR ");
      const semanticQuery = `${topicTerm} AND (${semanticKeywords})`;
      const layer2Articles = await searchPubMed(semanticQuery, 20);

      for (const article of layer2Articles) {
        if (!guidelineTitleMatchesQuery(query, article.title)) continue;
        // Check if we already have this article (by PMID)
        const existing = allArticles.find(
          (a) => a.article.pmid === article.pmid,
        );
        if (!existing) {
          const score = calculateGuidelineScore(article, false);
          allArticles.push({ article, score, hasPublicationType: false });
        }
      }
    }

    // Score all articles and filter by minimum threshold
    const scoredGuidelines: Array<{
      guideline: ClinicalGuideline;
      score: number;
    }> = [];

    for (const { article, score } of allArticles) {
      // Extract organization dynamically first (needed for scoring)
      const org = extractOrganization(article);

      // Apply organization filter if provided
      if (organization) {
        if (
          !organizationFilterMatches(organization, {
            organization: org,
            title: article.title,
            abstract: article.abstract,
            journal: article.journal,
          })
        ) {
          continue;
        }
      }

      // Update author affiliation score if organization pattern matched
      if (org !== "Unknown Organization") {
        score.authorAffiliation = GUIDELINE_SCORE_WEIGHTS.AUTHOR_AFFILIATION;
      }

      // Recalculate total score after affiliation check
      score.total =
        score.publicationType +
        score.titleKeywords +
        score.journalReputation +
        score.authorAffiliation +
        score.abstractKeywords +
        score.meshTerms;

      // Skip if below minimum threshold after updating affiliation score
      if (score.total < GUIDELINE_SCORE_WEIGHTS.MIN_SCORE_THRESHOLD) {
        continue;
      }

      // Extract year
      const yearMatch = article.publication_date.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : "Unknown";

      // Determine category (keep simple, generic approach)
      const title = article.title.toLowerCase();
      const abstract = (article.abstract || "").toLowerCase();
      let category = "General";
      if (
        title.includes("cardiology") ||
        abstract.includes("cardiac") ||
        abstract.includes("heart")
      )
        category = "Cardiology";
      else if (
        title.includes("oncology") ||
        abstract.includes("cancer") ||
        abstract.includes("tumor")
      )
        category = "Oncology";
      else if (title.includes("diabetes") || abstract.includes("diabetes"))
        category = "Endocrinology";
      else if (
        title.includes("pediatric") ||
        abstract.includes("pediatric") ||
        abstract.includes("children")
      )
        category = "Pediatrics";
      else if (
        title.includes("mental") ||
        abstract.includes("mental") ||
        abstract.includes("psychiatric")
      )
        category = "Psychiatry";

      // Determine evidence level
      let evidenceLevel = "Systematic Review/Consensus";
      if (title.includes("meta-analysis") || abstract.includes("meta-analysis"))
        evidenceLevel = "Meta-analysis";
      else if (
        title.includes("systematic review") ||
        abstract.includes("systematic review")
      )
        evidenceLevel = "Systematic Review";

      const guideline: ClinicalGuideline = {
        title: article.title,
        organization: org,
        year: year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
        description: (article.abstract || "").substring(0, 200) + "...",
        category: category,
        evidence_level: evidenceLevel,
      };

      scoredGuidelines.push({ guideline, score: score.total });
    }

    // Remove duplicates based on title similarity
    const uniqueGuidelines = scoredGuidelines.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (g) =>
            g.guideline.title.toLowerCase().replace(/[^\w\s]/g, "") ===
            item.guideline.title.toLowerCase().replace(/[^\w\s]/g, ""),
        ),
    );

    // Sort by score descending and return top results
    return uniqueGuidelines
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map((item) => item.guideline);
  } catch (error) {
    console.error("Error searching clinical guidelines:", error);
    return [];
  }
}

// REMOVED: All drug interaction checking code has been removed

// ============================================================================
// PEDIATRIC SOURCE FUNCTIONS
// ============================================================================

export async function searchBrightFuturesGuidelines(
  query: string,
): Promise<PediatricGuideline[]> {
  logger.info(
    "BrightFutures",
    `Searching Bright Futures via PubMed and Monid for: ${query}`,
  );
  const pubmedQuery = `(${quoteMultiWordQuery(query)}) AND "Bright Futures"[tiab]`;
  const pubmed = await searchPubMed(pubmedQuery, 8);
  const fromPubmed: PediatricGuideline[] = pubmed.map((article) => ({
    title: article.title,
    organization: "American Academy of Pediatrics",
    year: article.publication_date.slice(0, 4),
    url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    description: (article.abstract || "").substring(0, 300),
    age_group: "",
    category: "Preventive Care",
    source: "bright-futures" as const,
  }));

  const web = (
    await searchTinyFish(query, {
      limit: 10,
      extra: {
        domainType: "web",
        includeDomains: "brightfutures.aap.org",
        purpose: "Find AAP Bright Futures pediatric preventive care guidelines",
      },
    })
  )
    .filter((item) => isAllowedAapUrl(item.url))
    .map((item) => {
      const url = normalizeAapUrl(item.url || "");
      const classified = classifyAapResult(url, item.title);
      return {
        title: item.title,
        organization: "American Academy of Pediatrics",
        year: item.year || "",
        url,
        description: (item.abstract || "").substring(0, 300),
        age_group: "",
        category: classified.category,
        source: "bright-futures" as const,
      };
    });

  return dedupeGuidelines([...fromPubmed, ...web]);
}

export async function searchAAPPolicyStatements(
  query: string,
): Promise<PediatricGuideline[]> {
  logger.info(
    "AAPPolicy",
    `Searching AAP policy statements via PubMed and Monid for: ${query}`,
  );
  const pubmedQuery = `(${quoteMultiWordQuery(query)}) AND ("American Academy of Pediatrics"[Corporate Author] OR ("Pediatrics"[Journal] AND ("policy statement"[ti] OR "clinical report"[ti] OR "clinical practice guideline"[ti] OR "technical report"[ti])))`;
  const pubmed = await searchPubMed(pubmedQuery, 10);
  const fromPubmed: PediatricGuideline[] = pubmed.map((article) => {
    const classified = classifyAapResult(
      `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      article.title,
    );
    return {
      title: article.title,
      organization: "American Academy of Pediatrics",
      year: article.publication_date.slice(0, 4),
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      description: (article.abstract || "").substring(0, 300),
      category: classified.category,
      source: "aap-policy" as const,
    };
  });

  const web = (
    await searchTinyFish(query, {
      limit: 10,
      extra: {
        domainType: "web",
        includeDomains: "publications.aap.org,aap.org",
        purpose: "Find AAP policy statements and pediatric clinical guidelines",
      },
    })
  )
    .filter((item) => isAllowedAapUrl(item.url))
    .map((item) => {
      const url = normalizeAapUrl(item.url || "");
      const classified = classifyAapResult(url, item.title);
      return {
        title: item.title,
        organization: "American Academy of Pediatrics",
        year: item.year || "",
        url,
        description: (item.abstract || "").substring(0, 300),
        category: classified.category,
        source: classified.source,
      };
    });

  return dedupeGuidelines([...fromPubmed, ...web]);
}

function dedupeGuidelines(
  guidelines: PediatricGuideline[],
): PediatricGuideline[] {
  return guidelines.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (g) =>
          g.title.toLowerCase().replace(/[^\w\s]/g, "") ===
          item.title.toLowerCase().replace(/[^\w\s]/g, ""),
      ),
  );
}

export async function searchPediatricJournals(
  query: string,
  maxResults: number = 10,
): Promise<PediatricJournalArticle[]> {
  try {
    // Build journal filter query
    const journalFilters = PEDIATRIC_JOURNALS.map(
      (journal) => `"${journal}"[Journal]`,
    ).join(" OR ");

    const fullQuery = `(${query}) AND (${journalFilters})`;

    // Use existing searchPubMedArticles function with journal filter
    const articles = await searchPubMedArticles(fullQuery, maxResults);

    // Convert to PediatricJournalArticle format
    return articles.map((article) => ({
      pmid: article.pmid,
      title: article.title,
      abstract: article.abstract,
      authors: article.authors,
      journal: article.journal,
      publication_date: article.publication_date,
      doi: article.doi,
      pmc_id: article.pmc_id,
      full_text: article.full_text,
    }));
  } catch (error) {
    console.error("Error searching pediatric journals:", error);
    return [];
  }
}

export async function searchPediatricDrugs(
  query: string,
  limit: number = 10,
): Promise<DrugLabel[]> {
  try {
    // Search FDA drugs
    const drugs = await searchDrugs(query, limit * 2); // Get more to filter

    // Filter for pediatric labeling
    const pediatricDrugs = drugs.filter((drug) => {
      // Check purpose for pediatric indications
      const purpose = drug.purpose?.join(" ").toLowerCase() || "";
      const warnings = drug.warnings?.join(" ").toLowerCase() || "";
      const dosage =
        drug.dosage_and_administration?.join(" ").toLowerCase() || "";

      const hasPediatricIndication =
        purpose.includes("pediatric") ||
        purpose.includes("child") ||
        purpose.includes("infant") ||
        purpose.includes("neonatal") ||
        warnings.includes("pediatric") ||
        warnings.includes("child") ||
        dosage.includes("pediatric") ||
        dosage.includes("child") ||
        dosage.includes("pediatric dosing");

      return hasPediatricIndication;
    });

    return pediatricDrugs.slice(0, limit);
  } catch (error) {
    console.error("Error searching pediatric drugs:", error);
    return [];
  }
}

export async function searchAAPGuidelines(
  query: string,
): Promise<PediatricGuideline[]> {
  try {
    // Search both Bright Futures and AAP Policy Statements in parallel
    const [brightFutures, aapPolicy] = await Promise.allSettled([
      searchBrightFuturesGuidelines(query),
      searchAAPPolicyStatements(query),
    ]);

    const results: PediatricGuideline[] = [];

    if (brightFutures.status === "fulfilled") {
      results.push(...brightFutures.value);
    }

    if (aapPolicy.status === "fulfilled") {
      results.push(...aapPolicy.value);
    }

    // Remove duplicates based on title similarity
    const uniqueResults = results.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (g) =>
            g.title.toLowerCase().replace(/[^\w\s]/g, "") ===
            item.title.toLowerCase().replace(/[^\w\s]/g, ""),
        ),
    );

    return uniqueResults;
  } catch (error) {
    console.error("Error searching AAP guidelines:", error);
    return [];
  }
}

// ============================================================================
// CACHED WRAPPER FUNCTIONS
// ============================================================================

export interface CacheMetadata {
  cached: boolean;
  cacheAge: number; // seconds since cached
}

export interface CachedResult<T> {
  data: T;
  metadata: CacheMetadata;
}

const config = getCacheConfig();

/**
 * Helper to calculate cache age in seconds
 */
function getCacheAge(timestamp: Date): number {
  return Math.floor((new Date().getTime() - timestamp.getTime()) / 1000);
}

// Cached version of searchDrugs
export async function searchDrugsCached(
  query: string,
  limit: number = 10,
): Promise<CachedResult<DrugLabel[]>> {
  const cacheKey = cacheManager.generateKey("FDA", "search-drugs", {
    query,
    limit,
  });
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchDrugs(query, limit);
  cacheManager.set(cacheKey, data, config.ttls.fda, "FDA");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of getHealthIndicators
export async function getHealthIndicatorsCached(
  indicatorName: string,
  country?: string,
  limit?: number,
): Promise<CachedResult<WHOIndicator[]>> {
  const cacheKey = cacheManager.generateKey("WHO", "get-health-statistics", {
    indicator: indicatorName,
    country,
    limit,
  });
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await getHealthIndicators(indicatorName, country);
  cacheManager.set(cacheKey, data, config.ttls.who, "WHO");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchPubMedArticles
export async function searchPubMedArticlesCached(
  query: string,
  maxResults: number = 10,
): Promise<CachedResult<PubMedArticle[]>> {
  const cacheKey = cacheManager.generateKey(
    "PubMed",
    "search-medical-literature",
    {
      query,
      max_results: maxResults,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchPubMedArticles(query, maxResults);
  cacheManager.set(cacheKey, data, config.ttls.pubmed, "PubMed");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of getPubMedArticleByPMID
export async function getPubMedArticleByPMIDCached(
  pmid: string,
): Promise<CachedResult<PubMedArticle | null>> {
  const cacheKey = cacheManager.generateKey("PubMed", "get-article-details", {
    pmid,
  });
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await getPubMedArticleByPMID(pmid);
  cacheManager.set(cacheKey, data, config.ttls.pubmed, "PubMed");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchRxNormDrugs
export async function searchRxNormDrugsCached(
  query: string,
  limit: number = 25,
): Promise<CachedResult<RxNormDrug[]>> {
  const cacheKey = cacheManager.generateKey(
    "RxNorm",
    "search-drug-nomenclature",
    {
      query,
      limit,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchRxNormDrugs(query, limit);
  cacheManager.set(cacheKey, data, config.ttls.rxnorm, "RxNorm");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchGoogleScholar
export async function searchGoogleScholarCached(
  query: string,
): Promise<CachedResult<GoogleScholarArticle[]>> {
  const cacheKey = cacheManager.generateKey(
    "GoogleScholar",
    "search-google-scholar",
    {
      query,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchGoogleScholar(query);
  cacheManager.set(cacheKey, data, config.ttls.googleScholar, "GoogleScholar");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchClinicalGuidelines
export async function searchClinicalGuidelinesCached(
  query: string,
  organization?: string,
): Promise<CachedResult<ClinicalGuideline[]>> {
  const cacheKey = cacheManager.generateKey(
    "ClinicalGuidelines",
    "search-clinical-guidelines",
    {
      query,
      organization,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchClinicalGuidelines(query, organization);
  cacheManager.set(
    cacheKey,
    data,
    config.ttls.clinicalGuidelines,
    "ClinicalGuidelines",
  );

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchMedicalJournals
export async function searchMedicalJournalsCached(
  query: string,
): Promise<CachedResult<GoogleScholarArticle[]>> {
  const cacheKey = cacheManager.generateKey(
    "MedicalJournals",
    "search-medical-journals",
    {
      query,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchMedicalJournals(query);
  // Use shortest TTL (PubMed/Google Scholar) for multi-source queries
  cacheManager.set(
    cacheKey,
    data,
    Math.min(config.ttls.pubmed, config.ttls.googleScholar),
    "MedicalJournals",
  );

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchBrightFuturesGuidelines
export async function searchBrightFuturesGuidelinesCached(
  query: string,
): Promise<CachedResult<PediatricGuideline[]>> {
  const cacheKey = cacheManager.generateKey(
    "BrightFutures",
    "search-bright-futures",
    {
      query,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchBrightFuturesGuidelines(query);
  cacheManager.set(cacheKey, data, config.ttls.brightFutures, "BrightFutures");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchAAPPolicyStatements
export async function searchAAPPolicyStatementsCached(
  query: string,
): Promise<CachedResult<PediatricGuideline[]>> {
  const cacheKey = cacheManager.generateKey("AAPPolicy", "search-aap-policy", {
    query,
  });
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchAAPPolicyStatements(query);
  cacheManager.set(cacheKey, data, config.ttls.aapPolicy, "AAPPolicy");

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchPediatricJournals
export async function searchPediatricJournalsCached(
  query: string,
  maxResults: number = 10,
): Promise<CachedResult<PediatricJournalArticle[]>> {
  const cacheKey = cacheManager.generateKey(
    "PediatricJournals",
    "search-pediatric-journals",
    {
      query,
      maxResults,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchPediatricJournals(query, maxResults);
  cacheManager.set(
    cacheKey,
    data,
    config.ttls.pediatricJournals,
    "PediatricJournals",
  );

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchPediatricDrugs
export async function searchPediatricDrugsCached(
  query: string,
  limit: number = 10,
): Promise<CachedResult<DrugLabel[]>> {
  const cacheKey = cacheManager.generateKey(
    "PediatricDrugs",
    "search-pediatric-drugs",
    {
      query,
      limit,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchPediatricDrugs(query, limit);
  cacheManager.set(
    cacheKey,
    data,
    config.ttls.pediatricDrugs,
    "PediatricDrugs",
  );

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// Cached version of searchAAPGuidelines
export async function searchAAPGuidelinesCached(
  query: string,
): Promise<CachedResult<PediatricGuideline[]>> {
  const cacheKey = cacheManager.generateKey(
    "AAPGuidelines",
    "search-pediatric-guidelines",
    {
      query,
    },
  );
  const cached = cacheManager.get(cacheKey);

  if (cached) {
    return {
      data: cached.data,
      metadata: {
        cached: true,
        cacheAge: getCacheAge(cached.timestamp),
      },
    };
  }

  const data = await searchAAPGuidelines(query);
  // Use shorter TTL (AAP Policy) for combined queries
  cacheManager.set(
    cacheKey,
    data,
    Math.min(config.ttls.brightFutures, config.ttls.aapPolicy),
    "AAPGuidelines",
  );

  return {
    data,
    metadata: {
      cached: false,
      cacheAge: 0,
    },
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface SourceHealthStatus {
  source: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

/**
 * Ping each upstream source and report health status.
 * Used by the health-check MCP tool.
 */
export async function getSourceHealth(): Promise<{
  sources: SourceHealthStatus[];
  circuitBreakers: ReturnType<typeof getAllCircuitStatus>;
  rateLimiters: ReturnType<typeof getAllRateLimiterStatus>;
  cache: ReturnType<typeof cacheManager.getStats>;
  ncbiApiKey: boolean;
  monidApiKey: boolean;
  tinyfishApiKey: boolean;
}> {
  const checks: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "FDA",
      fn: async () => {
        await superagent
          .get(`${FDA_API_BASE}/drug/label.json`)
          .query({ search: 'openfda.brand_name:"aspirin"', limit: 1 })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
    {
      name: "PubMed",
      fn: async () => {
        const params: Record<string, any> = {
          db: "pubmed",
          term: "health",
          retmode: "json",
          retmax: 1,
        };
        if (NCBI_API_KEY) params.api_key = NCBI_API_KEY;
        await superagent
          .get(`${PUBMED_API_BASE}/esearch.fcgi`)
          .query(params)
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
    {
      name: "WHO",
      fn: async () => {
        await superagent
          .get(`${WHO_API_BASE}/Indicator`)
          .query({
            $filter: "contains(IndicatorName, 'life')",
            $format: "json",
            $top: 1,
          })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
    {
      name: "RxNorm",
      fn: async () => {
        await superagent
          .get(`${RXNAV_API_BASE}/drugs.json`)
          .query({ name: "aspirin" })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
    {
      name: "ClinicalTrials",
      fn: async () => {
        await superagent
          .get("https://clinicaltrials.gov/api/v2/studies")
          .query({ "query.term": "health", format: "json", pageSize: 1 })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
    {
      name: "SemanticScholar",
      fn: async () => {
        await superagent
          .get("https://api.semanticscholar.org/graph/v1/paper/search")
          .query({ query: "health", limit: 1, fields: "title" })
          .set("User-Agent", USER_AGENT)
          .timeout({ response: 10_000, deadline: 15_000 });
      },
    },
  ];

  const results = await Promise.allSettled(
    checks.map(async (check) => {
      const start = Date.now();
      try {
        await check.fn();
        return {
          source: check.name,
          status: "healthy" as const,
          latencyMs: Date.now() - start,
        };
      } catch (error) {
        const latencyMs = Date.now() - start;
        return {
          source: check.name,
          status: (latencyMs > 8_000 ? "degraded" : "down") as
            "degraded" | "down",
          latencyMs,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const sources: SourceHealthStatus[] = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { source: "unknown", status: "down" as const, error: "check failed" },
  );

  const registered = await getRegisteredSourceHealth();
  const seen = new Set(
    sources.map((source) => source.source.toLowerCase().replace(/[^a-z]/g, "")),
  );
  for (const extra of registered) {
    const key = extra.source.toLowerCase().replace(/[^a-z]/g, "");
    const isDuplicateCtgov =
      key === "clinicaltrialsgov" && seen.has("clinicaltrials");
    if (isDuplicateCtgov || seen.has(key)) {
      continue;
    }
    sources.push(extra);
    seen.add(key);
  }

  return {
    sources,
    circuitBreakers: getAllCircuitStatus(),
    rateLimiters: getAllRateLimiterStatus(),
    cache: cacheManager.getStats(),
    ncbiApiKey: !!NCBI_API_KEY,
    monidApiKey: !!MONID_API_KEY,
    tinyfishApiKey: !!TINYFISH_API_KEY,
  };
}
