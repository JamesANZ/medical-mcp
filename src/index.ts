import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getDrugByNDC,
  getHealthIndicators,
  searchDrugs,
  searchPubMedArticles,
  searchRxNormDrugs,
  searchGoogleScholar,
  getPubMedArticleByPMID,
  searchClinicalGuidelines,
  searchMedicalDatabases,
  searchMedicalJournals,
  createErrorResponse,
  formatDrugSearchResults,
  formatDrugDetails,
  formatHealthIndicators,
  formatPubMedArticles,
  formatGoogleScholarArticles,
  formatMedicalDatabasesSearch,
  formatMedicalJournalsSearch,
  formatArticleDetails,
  formatRxNormDrugs,
  formatClinicalGuidelines,
  logSafetyWarnings,
} from "./utils.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  executeCalculatorWithSafety,
  hasCalculator,
} from "./calculators/index.js";
import type { CalculatorType } from "./types.js";
import { createMCPResponse } from "./utils.js";
import {
  searchHealthTopics,
  getHealthTopicDetails,
  formatHealthTopics,
  formatHealthTopicDetails,
} from "./healthgov/index.js";
import {
  getPreventiveServices,
  formatPreventiveServices,
} from "./healthgov/index.js";
import {
  searchICD10Codes,
  searchCPTCodes,
  formatICD10Codes,
  formatCPTCodes,
} from "./icd10/index.js";

const server = new McpServer({
  name: "medical-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

logSafetyWarnings();

// MCP Tools
server.tool(
  "search-drugs",
  "Search for drug information using FDA database",
  {
    query: z
      .string()
      .describe("Drug name to search for (brand name or generic name)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Number of results to return (max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const drugs = await searchDrugs(query, limit);
      return formatDrugSearchResults(drugs, query);
    } catch (error: any) {
      return createErrorResponse("searching drugs", error);
    }
  },
);

server.tool(
  "get-drug-details",
  "Get detailed information about a specific drug by NDC (National Drug Code)",
  {
    ndc: z.string().describe("National Drug Code (NDC) of the drug"),
  },
  async ({ ndc }) => {
    try {
      const drug = await getDrugByNDC(ndc);
      return formatDrugDetails(drug, ndc);
    } catch (error: any) {
      return createErrorResponse("fetching drug details", error);
    }
  },
);

server.tool(
  "get-health-statistics",
  "Get health statistics and indicators from WHO Global Health Observatory",
  {
    indicator: z
      .string()
      .describe(
        "Health indicator to search for (e.g., 'Life expectancy', 'Mortality rate')",
      ),
    country: z
      .string()
      .optional()
      .describe("Country code (e.g., 'USA', 'GBR') - optional"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("Number of results to return (max 20)"),
  },
  async ({ indicator, country, limit }) => {
    try {
      const indicators = await getHealthIndicators(indicator, country);
      return formatHealthIndicators(indicators, indicator, country, limit);
    } catch (error: any) {
      return createErrorResponse("fetching health statistics", error);
    }
  },
);

server.tool(
  "search-medical-literature",
  "Search for medical research articles in PubMed",
  {
    query: z.string().describe("Medical topic or condition to search for"),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(10)
      .describe("Maximum number of articles to return (max 20)"),
  },
  async ({ query, max_results }) => {
    try {
      const articles = await searchPubMedArticles(query, max_results);
      return formatPubMedArticles(articles, query);
    } catch (error: any) {
      return createErrorResponse("searching medical literature", error);
    }
  },
);

server.tool(
  "get-article-details",
  "Get detailed information about a specific medical article by PMID",
  {
    pmid: z.string().describe("PubMed ID (PMID) of the article"),
  },
  async ({ pmid }) => {
    try {
      const article = await getPubMedArticleByPMID(pmid);
      return formatArticleDetails(article, pmid);
    } catch (error: any) {
      return createErrorResponse("fetching article details", error);
    }
  },
);

server.tool(
  "search-drug-nomenclature",
  "Search for drug information using RxNorm (standardized drug nomenclature)",
  {
    query: z.string().describe("Drug name to search for in RxNorm database"),
  },
  async ({ query }) => {
    try {
      const drugs = await searchRxNormDrugs(query);
      return formatRxNormDrugs(drugs, query);
    } catch (error: any) {
      return createErrorResponse("searching RxNorm", error);
    }
  },
);

server.tool(
  "search-google-scholar",
  "Search for academic research articles using Google Scholar",
  {
    query: z
      .string()
      .describe("Academic topic or research query to search for"),
  },
  async ({ query }) => {
    try {
      const articles = await searchGoogleScholar(query);
      return formatGoogleScholarArticles(articles, query);
    } catch (error: any) {
      return createErrorResponse("searching Google Scholar", error);
    }
  },
);

server.tool(
  "search-clinical-guidelines",
  "Search for clinical guidelines and practice recommendations from medical organizations",
  {
    query: z
      .string()
      .describe("Medical condition or topic to search for guidelines"),
    organization: z
      .string()
      .optional()
      .describe(
        "Specific medical organization to filter by (e.g., 'American Heart Association', 'WHO')",
      ),
  },
  async ({ query, organization }) => {
    try {
      const guidelines = await searchClinicalGuidelines(query, organization);
      return formatClinicalGuidelines(guidelines, query, organization);
    } catch (error: any) {
      return createErrorResponse("searching clinical guidelines", error);
    }
  },
);

// Enhanced Medical Database Search Tool
server.tool(
  "search-medical-databases",
  "Search across multiple medical databases (PubMed, Google Scholar, Cochrane, ClinicalTrials.gov) for comprehensive results",
  {
    query: z
      .string()
      .describe(
        "Medical topic or condition to search for across multiple databases",
      ),
  },
  async ({ query }) => {
    try {
      const articles = await searchMedicalDatabases(query);
      return formatMedicalDatabasesSearch(articles, query);
    } catch (error: any) {
      return createErrorResponse("searching medical databases", error);
    }
  },
);

// Enhanced Medical Journal Search Tool
server.tool(
  "search-medical-journals",
  "Search specific medical journals (NEJM, JAMA, Lancet, BMJ, Nature Medicine) for high-quality research",
  {
    query: z
      .string()
      .describe(
        "Medical topic or condition to search for in top medical journals",
      ),
  },
  async ({ query }) => {
    try {
      const articles = await searchMedicalJournals(query);
      return formatMedicalJournalsSearch(articles, query);
    } catch (error: any) {
      return createErrorResponse("searching medical journals", error);
    }
  },
);

// Clinical Calculator Tool
server.tool(
  "calculate-clinical-score",
  "Calculate clinical risk scores and medical calculations. FOR EDUCATIONAL USE ONLY. Not a substitute for clinical judgment.",
  {
    calculator: z
      .enum([
        // MVP Calculators
        "bmi",
        "bsa",
        "ibw",
        "chads2-vasc",
        "creatinine-clearance",
        "pediatric-dosing-weight",
        // Phase 4 Expansion - Cardiovascular
        "has-bled",
        // Phase 4 Expansion - Renal
        "mdrd",
        "ckd-epi",
        // Phase 4 Expansion - Critical Care
        "sofa",
        "qsofa",
        "wells",
        "curb65",
        "child-pugh",
        "meld",
        "anion-gap",
        // Phase 4 Expansion - Missing Critical
        "qtc-correction",
        "glasgow-coma-scale",
        "parkland-formula",
      ])
      .describe("Type of calculator to use"),
    parameters: z
      .record(z.any())
      .describe(
        "Calculator-specific parameters (see calculator documentation for required fields)",
      ),
    citation: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include medical guideline citations in output"),
  },
  async ({ calculator, parameters }) => {
    try {
      if (!hasCalculator(calculator)) {
        return createErrorResponse(
          "invalid calculator",
          new Error(`Unknown calculator type: ${calculator}`),
        );
      }

      const result = executeCalculatorWithSafety(
        calculator as CalculatorType,
        parameters,
      );

      return createMCPResponse(result.formattedOutput);
    } catch (error: any) {
      return createErrorResponse("calculating clinical score", error);
    }
  },
);

// Health.gov Topics Tools
server.tool(
  "search-health-topics",
  "Search for health topics from Health.gov MyHealthfinder",
  {
    query: z
      .string()
      .describe("Search query for health topics"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Number of results to return (max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const topics = await searchHealthTopics(query, limit);
      const formatted = formatHealthTopics(topics, query);
      return createMCPResponse(formatted);
    } catch (error: any) {
      return createErrorResponse("searching health topics", error);
    }
  },
);

server.tool(
  "get-health-topic-details",
  "Get detailed information about a specific health topic from Health.gov",
  {
    topicId: z.string().describe("Health topic ID from Health.gov"),
  },
  async ({ topicId }) => {
    try {
      const topic = await getHealthTopicDetails(topicId);
      const formatted = formatHealthTopicDetails(topic);
      return createMCPResponse(formatted);
    } catch (error: any) {
      return createErrorResponse("fetching health topic details", error);
    }
  },
);

server.tool(
  "get-preventive-services",
  "Get preventive service recommendations from Health.gov based on age, sex, and health behaviors",
  {
    age: z
      .number()
      .int()
      .min(0)
      .max(120)
      .optional()
      .describe("Age in years"),
    sex: z
      .enum(["male", "female"])
      .optional()
      .describe("Sex (male or female)"),
    pregnant: z
      .boolean()
      .optional()
      .describe("Whether patient is pregnant"),
    sexuallyActive: z
      .boolean()
      .optional()
      .describe("Whether patient is sexually active"),
    tobaccoUse: z
      .boolean()
      .optional()
      .describe("Whether patient uses tobacco"),
  },
  async ({ age, sex, pregnant, sexuallyActive, tobaccoUse }) => {
    try {
      const services = await getPreventiveServices({
        age,
        sex,
        pregnant,
        sexuallyActive,
        tobaccoUse,
      });
      const formatted = formatPreventiveServices(services, { age, sex });
      return createMCPResponse(formatted);
    } catch (error: any) {
      return createErrorResponse("fetching preventive services", error);
    }
  },
);

// ICD-10/CPT Code Lookup Tools (Phase 5 - Requires Licensing)
// NOTE: These tools require UMLS account (ICD-10) and AMA licensing (CPT)
// They will return errors until licensing is obtained

server.tool(
  "search-icd10-codes",
  "Search for ICD-10 codes by code prefix or partial description. Works best with code prefixes (e.g., 'E10', 'I10'). Uses NLM Clinical Tables API (public, no licensing required).",
  {
    query: z
      .string()
      .describe("ICD-10 code prefix (e.g., 'E10', 'I10') or partial description. Works best with code prefixes."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Number of results to return (max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const codes = await searchICD10Codes(query, limit);
      const formatted = formatICD10Codes(codes, query);
      return createMCPResponse(formatted);
    } catch (error: any) {
      return createErrorResponse("searching ICD-10 codes", error);
    }
  },
);

server.tool(
  "search-cpt-codes",
  "Search for CPT procedure codes by code or description. NOTE: Requires AMA (American Medical Association) licensing.",
  {
    query: z
      .string()
      .describe("CPT code or procedure description to search for"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Number of results to return (max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const codes = await searchCPTCodes(query, limit);
      const formatted = formatCPTCodes(codes, query);
      return createMCPResponse(formatted);
    } catch (error: any) {
      return createErrorResponse("searching CPT codes", error);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("✅ Medical MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
