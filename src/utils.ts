import {
  DrugLabel,
  GoogleScholarArticle,
  PubMedArticle,
  RxNormDrug,
  WHOIndicator,
  ClinicalGuideline,
  GuidelineScore,
} from "./types.js";
import superagent from "superagent";
import puppeteer from "puppeteer";
import {
  FDA_API_BASE,
  GOOGLE_SCHOLAR_API_BASE,
  PUBMED_API_BASE,
  PMC_API_BASE,
  RXNAV_API_BASE,
  USER_AGENT,
  WHO_API_BASE,
  GUIDELINE_PUBLICATION_TYPES,
  GUIDELINE_MESH_TERMS,
  GUIDELINE_KEYWORDS,
  GUIDELINE_SCORE_WEIGHTS,
  ORG_EXTRACTION_PATTERNS,
} from "./constants.js";

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
    "This system queries live medical databases (FDA, WHO, PubMed, RxNorm)",
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
      const res = await superagent
        .get(`${FDA_API_BASE}/drug/label.json`)
        .query({
          search: searchQuery,
          limit: limit,
        })
        .set("User-Agent", USER_AGENT);

      const results = res.body.results || [];
      for (const drug of results) {
        const ndc = drug.openfda?.product_ndc?.[0];
        if (ndc && !seenNDCs.has(ndc)) {
          seenNDCs.add(ndc);
          allResults.push(drug);
          if (allResults.length >= limit) break;
        }
      }
      if (allResults.length >= limit) break;
    } catch (error) {
      // Continue to next search strategy
      continue;
    }
  }

  return allResults;
}

export async function getDrugByNDC(ndc: string): Promise<DrugLabel | null> {
  try {
    const res = await superagent
      .get(`${FDA_API_BASE}/drug/label.json`)
      .query({
        search: `openfda.product_ndc:${ndc}`,
        limit: 1,
      })
      .set("User-Agent", USER_AGENT);

    return res.body.results?.[0] || null;
  } catch (error) {
    return null;
  }
}

export async function getHealthIndicators(
  indicatorName: string,
  country?: string,
): Promise<WHOIndicator[]> {
  try {
    // First, find the indicator code by searching for the indicator name
    let filter = `contains(IndicatorName, '${indicatorName}')`;

    let res = await superagent
      .get(`${WHO_API_BASE}/Indicator`)
      .query({
        $filter: filter,
        $format: "json",
      })
      .set("User-Agent", USER_AGENT);

    let indicators = res.body.value || [];

    // If no results, try common variations
    if (indicators.length === 0) {
      const variations = getIndicatorVariations(indicatorName);
      for (const variation of variations) {
        filter = `contains(IndicatorName, '${variation}')`;

        res = await superagent
          .get(`${WHO_API_BASE}/Indicator`)
          .query({
            $filter: filter,
            $format: "json",
          })
          .set("User-Agent", USER_AGENT);

        const variationResults = res.body.value || [];
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

        const queryParams: any = {
          $format: "json",
          $top: 50, // Limit results
        };

        if (dataFilter) {
          queryParams.$filter = dataFilter;
        }

        const dataRes = await superagent
          .get(`${WHO_API_BASE}/${indicatorCode}`)
          .query(queryParams)
          .set("User-Agent", USER_AGENT);

        const dataValues = dataRes.body.value || [];

        // Group data by country and get the most recent values
        const countryData = new Map();
        dataValues.forEach((item: any) => {
          const country = item.SpatialDim || "Global";
          const year = item.TimeDim || "Unknown";
          const value = item.NumericValue;

          if (value !== null && value !== undefined) {
            if (
              !countryData.has(country) ||
              year > countryData.get(country).year
            ) {
              countryData.set(country, {
                country,
                year,
                value,
                indicator: indicator.IndicatorName,
                unit: item.Unit || "Unknown",
              });
            }
          }
        });

        // Add the data to results with better formatting
        dataValues.forEach((item: any) => {
          // Extract full indicator name with all context from API
          const fullIndicatorName = indicator.IndicatorName || "Unknown Indicator";
          const unit = item.Unit || "Unknown";
          const value = item.NumericValue;
          const country = item.SpatialDim || "Global";
          const year = item.TimeDim || "Unknown";
          const ageGroup = item.AgeGroup || item.Age || "";
          const sex = item.Sex || item.Gender || "";
          const low = item.Low || item.LowerBound || 0;
          const high = item.High || item.UpperBound || 0;

          if (value !== null && value !== undefined) {
            // Format the value with unit
            let formattedValue = value;
            if (unit && unit !== "Unknown") {
              formattedValue = `${value} ${unit}`;
            }

            // Build descriptive comments with full context
            const commentParts: string[] = [];
            if (unit && unit !== "Unknown") {
              commentParts.push(`Unit: ${unit}`);
            }
            if (year && year !== "Unknown") {
              commentParts.push(`Year: ${year}`);
            }
            if (ageGroup) {
              commentParts.push(`Age Group: ${ageGroup}`);
            }
            if (sex) {
              commentParts.push(`Sex: ${sex}`);
            }

            results.push({
              IndicatorCode: indicator.IndicatorCode,
              IndicatorName: fullIndicatorName, // Use full indicator name from API
              SpatialDimType: item.SpatialDimType || "Country",
              SpatialDim: country,
              TimeDim: year.toString(),
              TimeDimType: item.TimeDimType || "Year",
              DataSourceDim: item.DataSourceDim || "WHO",
              DataSourceType: item.DataSourceType || "Official",
              Value: formattedValue,
              NumericValue: value,
              Low: low,
              High: high,
              Comments: commentParts.join(" | ") || "No additional context",
              Date: item.Date || new Date().toISOString(),
            });
          }
        });
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

    return results;
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

export async function searchRxNormDrugs(query: string): Promise<RxNormDrug[]> {
  try {
    const res = await superagent
      .get(`${RXNAV_API_BASE}/drugs.json`)
      .query({ name: query })
      .set("User-Agent", USER_AGENT);

    const drugGroup = res.body.drugGroup;
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

    return results;
  } catch (error) {
    console.error("Error searching RxNorm drugs:", error);
    return [];
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
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

function formatArticleItem(article: any, index: number): string {
  let result = `${index + 1}. **${article.title}**\n`;
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

export function formatDrugSearchResults(drugs: any[], query: string) {
  if (drugs.length === 0) {
    // Check if query might be invalid
    const commonWords = ["medication", "medicine", "drug", "pill", "tablet", "capsule"];
    if (commonWords.includes(query.toLowerCase().trim())) {
      return createMCPResponse(
        `No drugs found for "${query}". This appears to be a generic term rather than a specific drug name. Please search for a specific medication name (e.g., "aspirin", "ibuprofen", "metformin").`,
      );
    }
    return createMCPResponse(
      `No drugs found for "${query}". This medication may not be in the FDA database, or the name may be misspelled. Please verify the drug name and try again.`,
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

  return createMCPResponse(result);
}

// Helper function to format a drug section
function formatDrugSection(
  content: string | string[],
  maxLength: number = 500,
): string {
  if (!content) return "";
  const items = Array.isArray(content) ? content : [content];
  return items
    .map((item) => {
      if (item.length > maxLength) {
        return item.substring(0, maxLength) + "...";
      }
      return item;
    })
    .join("\n\n");
}

export function formatDrugDetails(drug: any, ndc: string) {
  if (!drug) {
    return createMCPResponse(`No drug found with NDC: ${ndc}`);
  }

  let result = `**Drug Details for NDC: ${ndc}**\n\n`;

  // Basic Information (always displayed)
  result += `**Basic Information:**\n`;
  result += `- Brand Name: ${drug.openfda?.brand_name?.[0] || "Not specified"}\n`;
  result += `- Generic Name: ${drug.openfda?.generic_name?.[0] || "Not specified"}\n`;
  result += `- Manufacturer: ${drug.openfda?.manufacturer_name?.[0] || "Not specified"}\n`;
  result += `- Route: ${drug.openfda?.route?.[0] || "Not specified"}\n`;
  result += `- Dosage Form: ${drug.openfda?.dosage_form?.[0] || "Not specified"}\n`;
  if (drug.openfda?.substance_name?.[0]) {
    result += `- Active Substance: ${drug.openfda.substance_name[0]}\n`;
  }
  result += `- Last Updated: ${drug.effective_time || "Not specified"}\n\n`;

  // Define section priority order and display names
  const sectionMap: Array<{
    key: string;
    displayName: string;
    priority: number;
  }> = [
    { key: "indications_and_usage", displayName: "Indications and Usage", priority: 1 },
    { key: "purpose", displayName: "Purpose/Uses", priority: 2 },
    { key: "description", displayName: "Description", priority: 3 },
    { key: "warnings", displayName: "Warnings", priority: 4 },
    { key: "contraindications", displayName: "Contraindications", priority: 5 },
    { key: "dosage_and_administration", displayName: "Dosage and Administration", priority: 6 },
    { key: "adverse_reactions", displayName: "Adverse Reactions", priority: 7 },
    { key: "drug_interactions", displayName: "Drug Interactions", priority: 8 },
    { key: "use_in_specific_populations", displayName: "Use in Specific Populations", priority: 9 },
    { key: "overdosage", displayName: "Overdosage", priority: 10 },
    { key: "clinical_pharmacology", displayName: "Clinical Pharmacology", priority: 11 },
    { key: "nonclinical_toxicology", displayName: "Nonclinical Toxicology", priority: 12 },
    { key: "clinical_studies", displayName: "Clinical Studies", priority: 13 },
    { key: "drug_abuse_and_dependence", displayName: "Drug Abuse and Dependence", priority: 14 },
    { key: "storage_and_handling", displayName: "Storage and Handling", priority: 15 },
    { key: "patient_counseling_information", displayName: "Patient Counseling Information", priority: 16 },
  ];

  // Collect all available sections
  const availableSections = sectionMap
    .filter((section) => {
      const value = drug[section.key];
      return (
        value &&
        (Array.isArray(value) ? value.length > 0 : value.trim().length > 0)
      );
    })
    .sort((a, b) => a.priority - b.priority);

  // Display sections in priority order
  for (const section of availableSections) {
    const content = drug[section.key];
    result += `**${section.displayName}:**\n`;
    if (Array.isArray(content)) {
      content.forEach((item: string, index: number) => {
        result += `${index + 1}. ${formatDrugSection(item, 800)}\n`;
      });
    } else {
      result += `${formatDrugSection(content, 800)}\n`;
    }
    result += "\n";
  }

  // Handle any other top-level keys not in our predefined list
  const handledKeys = new Set([
    "openfda",
    "effective_time",
    ...sectionMap.map((s) => s.key),
  ]);
  const otherKeys = Object.keys(drug).filter(
    (key) => !handledKeys.has(key) && drug[key] !== null && drug[key] !== undefined,
  );

  if (otherKeys.length > 0) {
    result += `**Additional Information:**\n`;
    for (const key of otherKeys) {
      const value = drug[key];
      if (value && (Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0)) {
        const displayKey = key
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        result += `- ${displayKey}: ${formatDrugSection(value, 300)}\n`;
      }
    }
    result += "\n";
  }

  // Note if no additional sections are available
  if (availableSections.length === 0 && otherKeys.length === 0) {
    result += `*No additional detailed information sections available for this drug.\n`;
    result += `Basic information is displayed above. For more details, please consult the full FDA label or a healthcare provider.*\n\n`;
  }

  return createMCPResponse(result);
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
      explanation:
        "Average number of years a person is expected to live",
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
      explanation: "Death rate, typically expressed per 1,000 or 100,000 population",
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
) {
  if (indicators.length === 0) {
    return createMCPResponse(
      `No health indicators found for "${indicator}"${country ? ` in ${country}` : ""}. Try a different search term.`,
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

  let itemIndex = 1;
  for (const category of categoryOrder) {
    if (!categorized.has(category)) continue;

    const categoryData = categorized.get(category)!;
    const categoryIndicators = categoryData.indicators;
    result += `## ${category}\n\n`;
    if (categoryData.explanation) {
      result += `*${categoryData.explanation}*\n\n`;
    }

    // Sort within category: most recent first, then by value
    const sorted = categoryIndicators
      .sort((a, b) => {
        // First by year (most recent first)
        const yearA = parseInt(a.TimeDim) || 0;
        const yearB = parseInt(b.TimeDim) || 0;
        if (yearB !== yearA) return yearB - yearA;
        // Then by numeric value (higher first for life expectancy, lower for mortality)
        return b.NumericValue - a.NumericValue;
      })
      .slice(0, Math.min(limit, categoryIndicators.length));

    sorted.forEach((ind) => {
      result += `${itemIndex}. **${ind.IndicatorName}**\n`;
      result += `   Country: ${ind.SpatialDim}\n`;
      result += `   Value: **${ind.Value}**\n`;
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

  return createMCPResponse(result);
}

export function formatPubMedArticles(articles: any[], query: string) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No medical articles found for "${query}". Try different search terms or check the spelling.`,
    );
  }

  let result = `**Medical Literature Search: "${query}"**\n\n`;
  result += `Found ${articles.length} article(s)\n\n`;

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

  return createMCPResponse(result);
}

export function formatGoogleScholarArticles(articles: any[], query: string) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No academic articles found for "${query}". This could be due to no results matching your query, rate limiting, or network issues.`,
    );
  }

  let result = `**Academic Research Search: "${query}"**\n\n`;
  result += `Found ${articles.length} article(s)\n\n`;

  articles.forEach((article, index) => {
    result += formatArticleItem(article, index);
  });

  return createMCPResponse(result);
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

export function formatMedicalDatabasesSearch(articles: any[], query: string) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No medical articles found for "${query}" across any databases. This could be due to no results matching your query, database API rate limiting, or network connectivity issues.`,
    );
  }

  let result = `**Comprehensive Medical Database Search: "${query}"**\n\n`;
  result += `Found ${articles.length} article(s) across multiple databases\n\n`;

  articles.forEach((article, index) => {
    result += formatArticleItem(article, index);
  });

  result += `\n🚨 **CRITICAL SAFETY WARNING:**\n`;
  result += `This comprehensive search retrieves information from multiple medical databases dynamically.\n\n`;
  result += `**DYNAMIC DATA SOURCES:**\n`;
  result += `• PubMed (National Library of Medicine)\n`;
  result += `• Google Scholar (Academic search)\n`;
  result += `• Cochrane Library (Systematic reviews)\n`;
  result += `• ClinicalTrials.gov (Clinical trials)\n`;
  result = addDataNote(result);

  return createMCPResponse(result);
}

export function formatMedicalJournalsSearch(articles: any[], query: string) {
  if (articles.length === 0) {
    return createMCPResponse(
      `No articles found for "${query}" in top medical journals. This could be due to no results matching your query, journal-specific search limitations, or network connectivity issues.`,
    );
  }

  let result = `**Top Medical Journals Search: "${query}"**\n\n`;
  result += `Found ${articles.length} article(s) from top medical journals\n\n`;

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

  return createMCPResponse(result);
}

export function formatArticleDetails(article: any, pmid: string) {
  if (!article) {
    return createMCPResponse(`No article found with PMID: ${pmid}`);
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
    result += `**Full Text:**\n${article.full_text}\n\n`;
  } else if (article.pmc_id) {
    result += `**Note:** Full text is available but could not be automatically retrieved. `;
    result += `Please visit the PMC URL above to access the complete article.\n\n`;
  } else {
    result += `**Note:** Full text is not available in PubMed Central. `;
    result += `You may need institutional access or subscription to view the complete article.\n\n`;
  }

  return createMCPResponse(result);
}

export function formatRxNormDrugs(drugs: any[], query: string) {
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

  return createMCPResponse(result);
}

export function formatClinicalGuidelines(
  guidelines: any[],
  query: string,
  organization?: string,
) {
  if (guidelines.length === 0) {
    return createMCPResponse(
      `No clinical guidelines found for "${query}"${organization ? ` from ${organization}` : ""}. Try a different search term or check if the condition has established guidelines.`,
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

  return createMCPResponse(result);
}

export async function searchGoogleScholar(
  query: string,
): Promise<GoogleScholarArticle[]> {
  let browser;
  try {
    console.log(`🔍 Scraping Google Scholar for: ${query}`);

    // Add random delay to avoid rate limiting
    await randomDelay(2000, 5000);

    // Enhanced browser configuration for better anti-detection
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-blink-features=AutomationControlled",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-images",
        "--disable-javascript",
        "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      ],
    });

    const page = await browser.newPage();

    // Enhanced stealth configuration
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    // Random viewport size
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
    ];
    const randomViewport =
      viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(randomViewport);

    // Rotate user agents
    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUA);

    // Enhanced headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    });

    // Navigate to Google Scholar with enhanced query
    const searchUrl = `${GOOGLE_SCHOLAR_API_BASE}?q=${encodeURIComponent(query)}&hl=en&as_sdt=0%2C5&as_ylo=2020`;
    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });

    // Wait for results with multiple fallback selectors
    try {
      await page.waitForSelector(".gs_r, .gs_ri, .gs_or, [data-rp]", {
        timeout: 20000,
      });
    } catch (error) {
      // Try alternative selectors
      try {
        await page.waitForSelector(".g, .rc, .r", { timeout: 10000 });
      } catch (error2) {
        console.error("No search results found or page structure changed");
        return [];
      }
    }

    // Enhanced data extraction with better selectors
    return await page.evaluate(() => {
      const results: GoogleScholarArticle[] = [];

      // Multiple selector strategies for different Google Scholar layouts
      const selectors = [
        ".gs_r, .gs_ri, .gs_or",
        ".g, .rc, .r",
        "[data-rp]",
        ".gs_rt, .gs_ri",
      ];

      let articleElements: NodeListOf<Element> | null = null;
      for (const selector of selectors) {
        articleElements = document.querySelectorAll(selector);
        if (articleElements.length > 0) break;
      }

      if (!articleElements || articleElements.length === 0) {
        return results;
      }

      articleElements.forEach((element) => {
        try {
          // Enhanced title extraction
          const titleSelectors = [
            ".gs_rt a, .gs_rt",
            "h3 a, h3",
            "a[data-clk]",
            ".gs_rt a",
            ".rc h3 a",
            ".r h3 a",
          ];

          let title = "";
          let url = "";
          for (const selector of titleSelectors) {
            const titleElement = element.querySelector(selector);
            if (titleElement) {
              title = titleElement.textContent?.trim() || "";
              url = (titleElement as HTMLAnchorElement)?.href || "";
              if (title) break;
            }
          }

          // Enhanced authors/venue extraction
          const authorSelectors = [
            ".gs_a, .gs_authors, .gs_venue",
            '[class*="author"]',
            '[class*="venue"]',
            ".gs_a",
            ".rc .s",
            ".r .s",
          ];

          let authors = "";
          for (const selector of authorSelectors) {
            const authorElement = element.querySelector(selector);
            if (authorElement) {
              authors = authorElement.textContent?.trim() || "";
              if (authors) break;
            }
          }

          // Enhanced abstract extraction
          const abstractSelectors = [
            ".gs_rs, .gs_rs_a, .gs_snippet",
            '[class*="snippet"]',
            '[class*="abstract"]',
            ".gs_rs",
            ".rc .st",
            ".r .st",
          ];

          let abstract = "";
          for (const selector of abstractSelectors) {
            const abstractElement = element.querySelector(selector);
            if (abstractElement) {
              abstract = abstractElement.textContent?.trim() || "";
              if (abstract) break;
            }
          }

          // Enhanced citation extraction
          const citationSelectors = [
            ".gs_fl a, .gs_fl",
            '[class*="citation"]',
            'a[href*="cites"]',
            ".gs_fl",
            ".rc .f",
            ".r .f",
          ];

          let citations = "";
          for (const selector of citationSelectors) {
            const citationElement = element.querySelector(selector);
            if (citationElement) {
              citations = citationElement.textContent?.trim() || "";
              if (citations) break;
            }
          }

          // Enhanced year extraction with better patterns
          let year = "";
          const yearPatterns = [
            /(\d{4})/g,
            /\((\d{4})\)/g,
            /(\d{4})\s*[–-]/g,
            /(\d{4})\s*$/g,
          ];

          const textSources = [authors, title, abstract, citations];
          for (const text of textSources) {
            for (const pattern of yearPatterns) {
              const matches = text.match(pattern);
              if (matches) {
                const years = matches
                  .map((m) => m.replace(/\D/g, ""))
                  .filter((y) => y.length === 4);
                const validYears = years.filter(
                  (y) =>
                    parseInt(y) >= 1900 &&
                    parseInt(y) <= new Date().getFullYear() + 1,
                );
                if (validYears.length > 0) {
                  year = validYears[validYears.length - 1]; // Get most recent year
                  break;
                }
              }
            }
            if (year) break;
          }

          // Enhanced journal extraction
          let journal = "";
          const journalPatterns = [
            /- ([^-]+)$/,
            /, ([^,]+)$/,
            /in ([^,]+)/,
            /([A-Z][^,]+(?:Journal|Review|Medicine|Health|Science|Research))/i,
            /([A-Z][^,]+(?:Lancet|Nature|Science|NEJM|JAMA|BMJ))/i,
          ];

          for (const pattern of journalPatterns) {
            const match = authors.match(pattern);
            if (match) {
              journal = match[1].trim();
              break;
            }
          }

          // Quality filter - only include substantial results
          if (title && title.length > 10 && title.length < 500) {
            results.push({
              title: title.substring(0, 500), // Limit title length
              authors: authors.substring(0, 300), // Limit authors length
              abstract: abstract.substring(0, 1000), // Limit abstract length
              journal: journal.substring(0, 200), // Limit journal length
              year,
              citations: citations.substring(0, 100), // Limit citations length
              url: url.substring(0, 500), // Limit URL length
            });
          }
        } catch (error) {
          console.error("Error processing article element:", error);
          // Skip this iteration
        }
      });

      return results;
    });
  } catch (error) {
    console.error("Error scraping Google Scholar:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function searchMedicalDatabases(
  query: string,
): Promise<GoogleScholarArticle[]> {
  console.log(`🔍 Searching medical databases for: ${query}`);

  // Try multiple medical databases in parallel
  const searches = await Promise.allSettled([
    searchPubMedArticles(query, 5),
    searchGoogleScholar(query),
    searchCochraneLibrary(query),
    searchClinicalTrials(query),
  ]);

  const results: GoogleScholarArticle[] = [];

  // Process PubMed results
  if (searches[0].status === "fulfilled" && searches[0].value) {
    searches[0].value.forEach((article) => {
      results.push({
        title: article.title,
        authors: article.authors.join(", "),
        abstract: article.abstract,
        journal: article.journal,
        year: article.publication_date.split("-")[0],
        citations: "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      });
    });
  }

  // Process Google Scholar results
  if (searches[1].status === "fulfilled" && searches[1].value) {
    results.push(...searches[1].value);
  }

  // Process Cochrane Library results
  if (searches[2].status === "fulfilled" && searches[2].value) {
    results.push(...searches[2].value);
  }

  // Process Clinical Trials results
  if (searches[3].status === "fulfilled" && searches[3].value) {
    results.push(...searches[3].value);
  }

  // Remove duplicates based on title similarity
  const uniqueResults = results.filter(
    (article, index, self) =>
      index ===
      self.findIndex(
        (a) =>
          a.title.toLowerCase().replace(/[^\w\s]/g, "") ===
          article.title.toLowerCase().replace(/[^\w\s]/g, ""),
      ),
  );

  return uniqueResults.slice(0, 20); // Limit to 20 results
}

async function searchCochraneLibrary(
  query: string,
): Promise<GoogleScholarArticle[]> {
  let browser;
  try {
    console.log(`🔍 Scraping Cochrane Library for: ${query}`);

    await randomDelay(1000, 3000);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    );

    // Search Cochrane Library
    const searchUrl = `https://www.cochranelibrary.com/search?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    return await page.evaluate(() => {
      const results: GoogleScholarArticle[] = [];
      const articles = document.querySelectorAll(
        ".search-result-item, .result-item, .search-result",
      );

      articles.forEach((article) => {
        const titleElement = article.querySelector(
          "h3 a, .title a, .result-title a",
        );
        const title = titleElement?.textContent?.trim() || "";
        const url = (titleElement as HTMLAnchorElement)?.href || "";

        const authorsElement = article.querySelector(
          ".authors, .author-list, .contributors",
        );
        const authors = authorsElement?.textContent?.trim() || "";

        const abstractElement = article.querySelector(
          ".abstract, .snippet, .summary",
        );
        const abstract = abstractElement?.textContent?.trim() || "";

        const journalElement = article.querySelector(
          ".journal, .source, .publication",
        );
        const journal =
          journalElement?.textContent?.trim() || "Cochrane Database";

        if (title && title.length > 10) {
          results.push({
            title,
            authors,
            abstract,
            journal,
            year: "",
            citations: "",
            url: url.startsWith("http")
              ? url
              : `https://www.cochranelibrary.com${url}`,
          });
        }
      });

      return results;
    });
  } catch (error) {
    console.error("Error scraping Cochrane Library:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function searchClinicalTrials(
  query: string,
): Promise<GoogleScholarArticle[]> {
  try {
    console.log(`🔍 Searching ClinicalTrials.gov for: ${query}`);

    const response = await superagent
      .get("https://clinicaltrials.gov/api/v2/studies")
      .query({
        query: query,
        format: "json",
        limit: 10,
      })
      .set("User-Agent", USER_AGENT);

    const data = response.body;
    const results: GoogleScholarArticle[] = [];

    if (data.studies && data.studies.length > 0) {
      data.studies.forEach((study: any) => {
        const protocolSection = study.protocolSection;
        if (protocolSection) {
          const identificationModule = protocolSection.identificationModule;
          const statusModule = protocolSection.statusModule;

          if (identificationModule) {
            results.push({
              title:
                identificationModule.briefTitle ||
                identificationModule.officialTitle ||
                "Clinical Trial",
              authors:
                identificationModule.leadSponsor?.name || "Clinical Trial",
              abstract: identificationModule.briefSummary || "",
              journal: "ClinicalTrials.gov",
              year: statusModule?.startDateStruct?.date || "",
              citations: "",
              url: `https://clinicaltrials.gov/study/${study.protocolSection.identificationModule.nctId}`,
            });
          }
        }
      });
    }

    return results;
  } catch (error) {
    console.error("Error searching ClinicalTrials.gov:", error);
    return [];
  }
}

export async function searchMedicalJournals(
  query: string,
): Promise<GoogleScholarArticle[]> {
  console.log(`🔍 Searching medical journals for: ${query}`);

  const journalSearches = await Promise.allSettled([
    searchJournal("NEJM", query),
    searchJournal("JAMA", query),
    searchJournal("Lancet", query),
    searchJournal("BMJ", query),
    searchJournal("Nature Medicine", query),
  ]);

  const results: GoogleScholarArticle[] = [];

  journalSearches.forEach((search) => {
    if (search.status === "fulfilled" && search.value) {
      results.push(...search.value);
    }
  });

  return results.slice(0, 15);
}

async function searchJournal(
  journalName: string,
  query: string,
): Promise<GoogleScholarArticle[]> {
  try {
    // Use Google Scholar with journal-specific search
    const journalQuery = `"${journalName}" ${query}`;
    return await searchGoogleScholar(journalQuery);
  } catch (error) {
    console.error(`Error searching ${journalName}:`, error);
    return [];
  }
}

async function fetchFullTextFromPMC(pmc_id: string): Promise<string | null> {
  let browser;
  try {
    // Try multiple methods to get full text

    // Method 1: Try PMC's XML/PMC format API
    try {
      const pmcXmlUrl = `${PMC_API_BASE}/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmc_id}&metadataPrefix=pmc`;
      const xmlResponse = await superagent
        .get(pmcXmlUrl)
        .set("User-Agent", USER_AGENT)
        .timeout(30000);

      const xmlText = xmlResponse.text;

      // Extract text from body sections
      const bodyMatches = xmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/gi);
      if (bodyMatches && bodyMatches.length > 0) {
        let fullText = "";
        for (const body of bodyMatches) {
          const text = body
            .replace(/<[^>]*>/g, " ") // Remove tags
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
          if (text.length > 100) {
            // Only include substantial sections
            fullText += text + "\n\n";
          }
        }
        if (fullText.trim().length > 500) {
          return fullText.trim();
        }
      }
    } catch (xmlError) {
      // Continue to next method
      console.log(`PMC XML method failed for ${pmc_id}, trying HTML method`);
    }

    // Method 2: Scrape HTML page using puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const pmcHtmlUrl = `${PMC_API_BASE}/articles/PMC${pmc_id}/`;
    await page.goto(pmcHtmlUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Extract full text from the page
    const fullText = await page.evaluate(() => {
      // Try to get the main content
      const selectors = [
        "#mc",
        ".article-content",
        ".main-content",
        "article",
        "[role='main']",
        ".full-text",
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Get all paragraph text
          const paragraphs = element.querySelectorAll("p");
          if (paragraphs.length > 0) {
            let text = "";
            paragraphs.forEach((p) => {
              const pText = p.textContent?.trim();
              if (pText && pText.length > 20) {
                text += pText + "\n\n";
              }
            });
            if (text.trim().length > 500) {
              return text.trim();
            }
          }
        }
      }

      // Fallback: get all visible text
      const body = document.body;
      if (body) {
        // Remove script and style elements
        const scripts = body.querySelectorAll(
          "script, style, nav, footer, header",
        );
        scripts.forEach((el) => el.remove());

        return body.innerText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 20)
          .join("\n\n")
          .substring(0, 50000); // Limit to 50k chars
      }

      return null;
    });

    if (fullText && fullText.trim().length > 500) {
      return fullText.trim();
    }

    return null;
  } catch (error) {
    console.error(`Error fetching full text from PMC ${pmc_id}:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function searchPubMedArticles(
  query: string,
  maxResults: number = 10,
): Promise<PubMedArticle[]> {
  try {
    // First, search for article IDs
    const searchRes = await superagent
      .get(`${PUBMED_API_BASE}/esearch.fcgi`)
      .query({
        db: "pubmed",
        term: query,
        retmode: "json",
        retmax: maxResults,
      })
      .set("User-Agent", USER_AGENT);

    const idList = searchRes.body.esearchresult?.idlist || [];

    if (idList.length === 0) return [];

    // Then, fetch article details
    const fetchRes = await superagent
      .get(`${PUBMED_API_BASE}/efetch.fcgi`)
      .query({
        db: "pubmed",
        id: idList.join(","),
        retmode: "xml",
      })
      .set("User-Agent", USER_AGENT);

    const articles = parsePubMedXML(fetchRes.text);

    // Fetch full text for articles with PMC ID (limit to first 3 to avoid rate limiting)
    const articlesWithFullText = await Promise.all(
      articles.slice(0, 3).map(async (article) => {
        if (article.pmc_id) {
          try {
            const fullText = await fetchFullTextFromPMC(article.pmc_id);
            if (fullText) {
              article.full_text = fullText;
            }
          } catch (error) {
            console.error(
              `Error fetching full text for PMID ${article.pmid}:`,
              error,
            );
          }
        }
        return article;
      }),
    );

    // Combine articles with full text and those without
    return [...articlesWithFullText, ...articles.slice(3)];
  } catch (error) {
    console.error("Error searching PubMed:", error);
    return [];
  }
}

export function parsePubMedXML(xmlText: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];

  // Split by article boundaries
  const articleMatches = xmlText.match(
    /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g,
  );

  if (!articleMatches) return articles;

  for (const articleXml of articleMatches) {
    try {
      // Extract PMID
      const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const pmid = pmidMatch?.[1];
      if (!pmid) continue;

      // Extract title
      const titleMatch = articleXml.match(
        /<ArticleTitle[^>]*>([^<]+)<\/ArticleTitle>/,
      );
      const title = titleMatch?.[1]?.trim() || "No title available";

      // Extract abstract
      let abstract = "No abstract available";
      const abstractMatch = articleXml.match(
        /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/,
      );
      if (abstractMatch) {
        abstract = abstractMatch[1]
          .replace(/<[^>]*>/g, "") // Remove HTML tags
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();
      }

      // Extract authors
      const authors: string[] = [];
      const authorMatches = articleXml.match(/<Author[\s\S]*?<\/Author>/g);
      if (authorMatches) {
        for (const authorXml of authorMatches) {
          const lastNameMatch = authorXml.match(
            /<LastName>([^<]+)<\/LastName>/,
          );
          const firstNameMatch = authorXml.match(
            /<ForeName>([^<]+)<\/ForeName>/,
          );
          const collectiveNameMatch = authorXml.match(
            /<CollectiveName>([^<]+)<\/CollectiveName>/,
          );

          if (collectiveNameMatch) {
            authors.push(collectiveNameMatch[1].trim());
          } else if (lastNameMatch && firstNameMatch) {
            authors.push(
              `${firstNameMatch[1].trim()} ${lastNameMatch[1].trim()}`,
            );
          } else if (lastNameMatch) {
            authors.push(lastNameMatch[1].trim());
          }
        }
      }

      // Extract journal information
      let journal = "Journal information not available";
      const journalMatch = articleXml.match(/<Title>([^<]+)<\/Title>/);
      if (journalMatch) {
        journal = journalMatch[1].trim();
      }

      // Extract publication date
      let publicationDate = "Date not available";
      const yearMatch = articleXml.match(/<Year>(\d{4})<\/Year>/);
      const monthMatch = articleXml.match(/<Month>(\d{1,2})<\/Month>/);
      const dayMatch = articleXml.match(/<Day>(\d{1,2})<\/Day>/);

      if (yearMatch) {
        const year = yearMatch[1];
        const month = monthMatch?.[1]?.padStart(2, "0") || "01";
        const day = dayMatch?.[1]?.padStart(2, "0") || "01";
        publicationDate = `${year}-${month}-${day}`;
      }

      // Extract DOI
      let doi: string | undefined;
      const doiMatch = articleXml.match(
        /<ELocationID[^>]*EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/,
      );
      if (doiMatch) {
        doi = doiMatch[1].trim();
      }

      // Extract PMC ID
      let pmc_id: string | undefined;
      const pmcIdPatterns = [
        /<ArticleId[^>]*IdType="pmc"[^>]*>PMC(\d+)<\/ArticleId>/i,
        /<ArticleId[^>]*IdType="pmc"[^>]*>(\d+)<\/ArticleId>/i,
      ];
      for (const pattern of pmcIdPatterns) {
        const pmcMatch = articleXml.match(pattern);
        if (pmcMatch) {
          pmc_id = pmcMatch[1].trim();
          break;
        }
      }

      articles.push({
        pmid,
        title,
        abstract,
        authors,
        journal,
        publication_date: publicationDate,
        doi,
        pmc_id,
      });
    } catch (error) {
      console.error("Error parsing individual article:", error);
    }
  }

  return articles;
}

export async function getPubMedArticleByPMID(
  pmid: string,
): Promise<PubMedArticle | null> {
  try {
    const fetchRes = await superagent
      .get(`${PUBMED_API_BASE}/efetch.fcgi`)
      .query({
        db: "pubmed",
        id: pmid,
        retmode: "xml",
      })
      .set("User-Agent", USER_AGENT);

    const articles = parsePubMedXML(fetchRes.text);
    const article = articles[0] || null;

    if (article && article.pmc_id) {
      // Always try to fetch full text for individual article requests
      try {
        const fullText = await fetchFullTextFromPMC(article.pmc_id);
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

// Helper function to extract organization dynamically using patterns
function extractOrganization(article: PubMedArticle): string {
  let org = "Unknown Organization";

  // Try to extract from journal first
  if (article.journal) {
    org = article.journal;
  }

  // Try to extract from abstract using generic patterns
  if (article.abstract) {
    for (const pattern of ORG_EXTRACTION_PATTERNS) {
      const matches = article.abstract.match(pattern);
      if (matches && matches.length > 0) {
        // Take the first full match
        const fullMatch = matches[0];
        org = fullMatch;
        break;
      }
    }
  }

  // Try to extract from title if still unknown
  if (org === "Unknown Organization" && article.title) {
    for (const pattern of ORG_EXTRACTION_PATTERNS) {
      const matches = article.title.match(pattern);
      if (matches && matches.length > 0) {
        org = matches[0];
        break;
      }
    }
  }

  return org;
}

// Helper function to search PubMed with a query
async function searchPubMed(
  query: string,
  maxResults: number = 20,
): Promise<PubMedArticle[]> {
  try {
    const searchRes = await superagent
      .get(`${PUBMED_API_BASE}/esearch.fcgi`)
      .query({
        db: "pubmed",
        term: query,
        retmode: "json",
        retmax: maxResults,
      })
      .set("User-Agent", USER_AGENT);

    const idList = searchRes.body.esearchresult?.idlist || [];
    if (idList.length === 0) return [];

    // Fetch article details
    const fetchRes = await superagent
      .get(`${PUBMED_API_BASE}/efetch.fcgi`)
      .query({
        db: "pubmed",
        id: idList.join(","),
        retmode: "xml",
      })
      .set("User-Agent", USER_AGENT);

    return parsePubMedXML(fetchRes.text);
  } catch (error) {
    console.error(`Error searching PubMed with query: ${query}`, error);
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
    const pubTypeQuery = `(${query}) AND (${GUIDELINE_PUBLICATION_TYPES.join(" OR ")})`;
    const layer1Articles = await searchPubMed(pubTypeQuery, 20);

    for (const article of layer1Articles) {
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
      const semanticQuery = `(${query}) AND (${semanticKeywords})`;
      const layer2Articles = await searchPubMed(semanticQuery, 20);

      for (const article of layer2Articles) {
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
        const orgLower = org.toLowerCase();
        const titleLower = article.title.toLowerCase();
        const abstractLower = (article.abstract || "").toLowerCase();
        const journalLower = (article.journal || "").toLowerCase();
        const orgFilterLower = organization.toLowerCase();

        // Check if organization appears in any relevant field
        const matchesOrg =
          orgLower.includes(orgFilterLower) ||
          titleLower.includes(orgFilterLower) ||
          abstractLower.includes(orgFilterLower) ||
          journalLower.includes(orgFilterLower);

        // Also check for common abbreviations/aliases
        const orgAbbreviations: { [key: string]: string[] } = {
          aap: ["american academy of pediatrics", "american academy pediatric"],
          who: ["world health organization"],
          cdc: ["centers for disease control"],
          aha: ["american heart association"],
          acc: ["american college of cardiology"],
          ada: ["american diabetes association"],
          acp: ["american college of physicians"],
        };

        let matchesAbbreviation = false;
        if (orgAbbreviations[orgFilterLower]) {
          for (const fullName of orgAbbreviations[orgFilterLower]) {
            if (
              orgLower.includes(fullName) ||
              titleLower.includes(fullName) ||
              abstractLower.includes(fullName)
            ) {
              matchesAbbreviation = true;
              break;
            }
          }
        }

        if (!matchesOrg && !matchesAbbreviation) {
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
      else if (
        title.includes("diabetes") ||
        abstract.includes("diabetes")
      )
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
      if (
        title.includes("meta-analysis") ||
        abstract.includes("meta-analysis")
      )
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
            g.guideline.title
              .toLowerCase()
              .replace(/[^\w\s]/g, "") ===
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

