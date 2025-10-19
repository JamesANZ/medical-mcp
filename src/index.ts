import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  parseServerConfig,
  displaySafetyNotices,
  displayServerInfo,
} from "./config.js";
import { createHttpServer } from "./http-server.js";
import {
  getDrugByNDC,
  getHealthIndicators,
  searchDrugs,
  searchPubMedArticles,
  searchRxNormDrugs,
  searchGoogleScholar,
  getPubMedArticleByPMID,
  searchClinicalGuidelines,
  checkDrugInteractions,
  searchMedicalDatabases,
  searchMedicalJournals,
  createErrorResponse,
  formatDrugSearchResults,
  formatDrugDetails,
  formatHealthIndicators,
  formatPubMedArticles,
  formatGoogleScholarArticles,
  formatDrugInteractions,
  formatMedicalDatabasesSearch,
  formatMedicalJournalsSearch,
  formatArticleDetails,
  formatRxNormDrugs,
  formatClinicalGuidelines,
} from "./utils.js";
import {
  getLatestPBSSchedule,
  listPBSSchedules,
  getPBSItem,
  searchPBSItems,
  searchPBSGeneral,
  getPBSFeesForItem,
  listPBSDispensingRules,
  getPBSOrganisationForItem,
  getPBSCopayments,
  getPBSRestrictionsForItem,
  getPBSScheduleEffectiveDate,
  listPBSPrograms,
  getPBSItemRestrictions,
  formatLatestPBSSchedule,
  formatPBSSchedules,
  formatPBSItem,
  formatPBSSearchResults,
  formatPBSFees,
  formatPBSCopayments,
  formatPBSRestrictions,
  formatPBSPrograms,
  formatPBSOrganisation,
  formatPBSDispensingRules,
  formatPBSScheduleEffectiveDate,
} from "./pbs-utils.js";

const server = new McpServer({
  name: "medical-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Display global safety notices
displaySafetyNotices();

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

server.tool(
  "check-drug-interactions",
  "Check for potential drug-drug interactions between two medications",
  {
    drug1: z.string().describe("First drug name"),
    drug2: z.string().describe("Second drug name"),
  },
  async ({ drug1, drug2 }) => {
    try {
      const interactions = await checkDrugInteractions(drug1, drug2);
      return formatDrugInteractions(interactions, drug1, drug2);
    } catch (error: any) {
      return createErrorResponse("checking drug interactions", error);
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

// PBS (Pharmaceutical Benefits Scheme) Tools

server.tool(
  "pbs-get-latest-schedule",
  "Get current PBS schedule code",
  {},
  async () => {
    try {
      const schedule = await getLatestPBSSchedule();
      return formatLatestPBSSchedule(schedule);
    } catch (error: any) {
      return createErrorResponse("fetching latest PBS schedule", error);
    }
  },
);

server.tool("pbs-list-schedules", "List PBS schedules", {}, async () => {
  try {
    const schedules = await listPBSSchedules();
    return formatPBSSchedules(schedules);
  } catch (error: any) {
    return createErrorResponse("listing PBS schedules", error);
  }
});

server.tool(
  "pbs-get-item",
  "Get PBS item by code",
  {
    itemCode: z
      .string()
      .regex(
        /^[0-9]{4,6}[A-Z]?$/,
        "Invalid PBS item code format (should be 4-6 digits optionally followed by a letter)",
      )
      .describe("PBS item code to retrieve (e.g., '1234' or '12345A')"),
  },
  async ({ itemCode }) => {
    try {
      const item = await getPBSItem(itemCode);
      return formatPBSItem(item, itemCode);
    } catch (error: any) {
      return createErrorResponse("fetching PBS item", error);
    }
  },
);

server.tool(
  "pbs-search-item-overview",
  "Search PBS items with filters",
  {
    itemName: z.string().optional().describe("Item name to search for"),
    manufacturer: z.string().optional().describe("Manufacturer to filter by"),
    scheduleCode: z.string().optional().describe("Schedule code to filter by"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of results to return (max 100)"),
  },
  async ({ itemName, manufacturer, scheduleCode, limit }) => {
    try {
      const items = await searchPBSItems(
        itemName,
        manufacturer,
        scheduleCode,
        limit,
      );
      const query = [itemName, manufacturer, scheduleCode]
        .filter(Boolean)
        .join(" ");
      return formatPBSSearchResults(items, query || "all items");
    } catch (error: any) {
      return createErrorResponse("searching PBS items", error);
    }
  },
);

server.tool(
  "pbs-search",
  "General PBS API search",
  {
    query: z
      .string()
      .min(1)
      .max(100)
      .regex(
        /^[a-zA-Z0-9\s\-'&().,]+$/,
        "Search query contains invalid characters",
      )
      .describe("Search query (drug names, manufacturers, etc.)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of results to return (max 100)"),
  },
  async ({ query, limit }) => {
    try {
      const items = await searchPBSGeneral(query, limit);
      return formatPBSSearchResults(items, query);
    } catch (error: any) {
      return createErrorResponse("performing PBS search", error);
    }
  },
);

server.tool(
  "pbs-get-fees-for-item",
  "Get PBS fees for specific items",
  {
    itemCode: z.string().describe("PBS item code to get fees for"),
  },
  async ({ itemCode }) => {
    try {
      const fees = await getPBSFeesForItem(itemCode);
      return formatPBSFees(fees, itemCode);
    } catch (error: any) {
      return createErrorResponse("fetching PBS fees", error);
    }
  },
);

server.tool(
  "pbs-list-dispensing-rules",
  "List PBS dispensing rules",
  {},
  async () => {
    try {
      const rules = await listPBSDispensingRules();
      return formatPBSDispensingRules(rules);
    } catch (error: any) {
      return createErrorResponse("listing PBS dispensing rules", error);
    }
  },
);

server.tool(
  "pbs-get-organisation-for-item",
  "Get manufacturer info for item",
  {
    itemCode: z.string().describe("PBS item code to get manufacturer info for"),
  },
  async ({ itemCode }) => {
    try {
      const organisation = await getPBSOrganisationForItem(itemCode);
      return formatPBSOrganisation(organisation, itemCode);
    } catch (error: any) {
      return createErrorResponse("fetching PBS organisation", error);
    }
  },
);

server.tool(
  "pbs-get-copayments",
  "Get PBS copayment information",
  {},
  async () => {
    try {
      const copayments = await getPBSCopayments();
      return formatPBSCopayments(copayments);
    } catch (error: any) {
      return createErrorResponse("fetching PBS copayments", error);
    }
  },
);

server.tool(
  "pbs-get-restrictions-for-item",
  "Get PBS restriction details for item",
  {
    itemCode: z.string().describe("PBS item code to get restrictions for"),
  },
  async ({ itemCode }) => {
    try {
      const restrictions = await getPBSRestrictionsForItem(itemCode);
      return formatPBSRestrictions(restrictions, itemCode);
    } catch (error: any) {
      return createErrorResponse("fetching PBS restrictions", error);
    }
  },
);

server.tool(
  "pbs-get-schedule-effective-date",
  "Get schedule effective dates",
  {
    scheduleCode: z
      .string()
      .describe("PBS schedule code to get effective date for"),
  },
  async ({ scheduleCode }) => {
    try {
      const effectiveDate = await getPBSScheduleEffectiveDate(scheduleCode);
      return formatPBSScheduleEffectiveDate(effectiveDate, scheduleCode);
    } catch (error: any) {
      return createErrorResponse("fetching PBS schedule effective date", error);
    }
  },
);

server.tool("pbs-list-programs", "List PBS programs", {}, async () => {
  try {
    const programs = await listPBSPrograms();
    return formatPBSPrograms(programs);
  } catch (error: any) {
    return createErrorResponse("listing PBS programs", error);
  }
});

server.tool(
  "pbs-get-item-restrictions",
  "Get detailed item restrictions",
  {
    itemCode: z
      .string()
      .describe("PBS item code to get detailed restrictions for"),
  },
  async ({ itemCode }) => {
    try {
      const restrictions = await getPBSItemRestrictions(itemCode);
      return formatPBSRestrictions(restrictions, itemCode);
    } catch (error: any) {
      return createErrorResponse(
        "fetching detailed PBS item restrictions",
        error,
      );
    }
  },
);

async function main() {
  // Parse configuration from command line arguments and environment variables
  const args = process.argv.slice(2);
  const config = parseServerConfig(args);

  // Display server startup information
  displayServerInfo(config);

  if (config.mode === "http") {
    // Create HTTP server using the new module
    await createHttpServer({ config });
  } else {
    // Default stdio transport (already localhost-only)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ Medical MCP Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
