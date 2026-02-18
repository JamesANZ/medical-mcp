import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
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
  formatBrightFuturesGuidelines,
  formatAAPPolicyStatements,
  formatPediatricJournals,
  formatChildHealthIndicators,
  formatPediatricDrugs,
  formatAAPGuidelines,
  logSafetyWarnings,
  searchDrugsCached,
  getDrugByNDCCached,
  getHealthIndicatorsCached,
  searchPubMedArticlesCached,
  getPubMedArticleByPMIDCached,
  searchRxNormDrugsCached,
  searchGoogleScholarCached,
  searchClinicalGuidelinesCached,
  searchMedicalDatabasesCached,
  searchMedicalJournalsCached,
  searchBrightFuturesGuidelinesCached,
  searchAAPPolicyStatementsCached,
  searchPediatricJournalsCached,
  getChildHealthIndicatorsCached,
  searchPediatricDrugsCached,
  searchAAPGuidelinesCached,
} from "./utils.js";
import { cacheManager } from "./cache/manager.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import express from "express";
import cors from "cors";


logSafetyWarnings();

// get arguments
function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(prefix));
  if (!arg) return undefined;
  const [, value] = arg.split("=", 2);
  return value;
}

const server = new McpServer({
  name: "medical-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

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
      const result = await searchDrugsCached(query, limit);
      return formatDrugSearchResults(result.data, query, result.metadata);
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
      const result = await getDrugByNDCCached(ndc);
      return formatDrugDetails(result.data, ndc, result.metadata);
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
      const result = await getHealthIndicatorsCached(indicator, country, limit);
      return formatHealthIndicators(
        result.data,
        indicator,
        country,
        limit,
        result.metadata,
      );
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
      const result = await searchPubMedArticlesCached(query, max_results);
      return formatPubMedArticles(result.data, query, result.metadata);
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
      const result = await getPubMedArticleByPMIDCached(pmid);
      return formatArticleDetails(result.data, pmid, result.metadata);
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
      const result = await searchRxNormDrugsCached(query);
      return formatRxNormDrugs(result.data, query, result.metadata);
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
      const result = await searchGoogleScholarCached(query);
      return formatGoogleScholarArticles(result.data, query, result.metadata);
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
      const result = await searchClinicalGuidelinesCached(query, organization);
      return formatClinicalGuidelines(
        result.data,
        query,
        organization,
        result.metadata,
      );
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
      const result = await searchMedicalDatabasesCached(query);
      return formatMedicalDatabasesSearch(result.data, query, result.metadata);
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
      const result = await searchMedicalJournalsCached(query);
      return formatMedicalJournalsSearch(result.data, query, result.metadata);
    } catch (error: any) {
      return createErrorResponse("searching medical journals", error);
    }
  },
);

// Cache Statistics Tool
server.tool(
  "get-cache-stats",
  "Get cache statistics including hit rate, total entries, and memory usage",
  {},
  async () => {
    try {
      const stats = cacheManager.getStats();
      const statsText =
        `**Cache Statistics**\n\n` +
        `Total Entries: ${stats.totalEntries}\n` +
        `Cache Hits: ${stats.hits}\n` +
        `Cache Misses: ${stats.misses}\n` +
        `Hit Rate: ${stats.hitRate}%\n` +
        `Miss Rate: ${stats.missRate}%\n` +
        `Memory Usage (estimate): ${(stats.memoryUsageEstimate / 1024 / 1024).toFixed(2)} MB\n` +
        `${stats.oldestEntry ? `Oldest Entry: ${stats.oldestEntry.toISOString()}\n` : ""}` +
        `${stats.newestEntry ? `Newest Entry: ${stats.newestEntry.toISOString()}\n` : ""}`;
      return {
        content: [
          {
            type: "text" as const,
            text: statsText,
          },
        ],
      };
    } catch (error: any) {
      return createErrorResponse("fetching cache statistics", error);
    }
  },
);

// Pediatric Source Tools
server.tool(
  "search-pediatric-guidelines",
  "Search for pediatric guidelines from AAP (Bright Futures and Policy Statements)",
  {
    query: z
      .string()
      .describe(
        "Medical condition or topic to search for pediatric guidelines",
      ),
    source: z
      .enum(["bright-futures", "aap-policy", "all"])
      .optional()
      .default("all")
      .describe(
        "Source to search: 'bright-futures' for preventive care guidelines, 'aap-policy' for policy statements, or 'all' for both",
      ),
  },
  async ({ query, source }) => {
    try {
      if (source === "bright-futures") {
        const result = await searchBrightFuturesGuidelinesCached(query);
        return formatBrightFuturesGuidelines(
          result.data,
          query,
          result.metadata,
        );
      } else if (source === "aap-policy") {
        const result = await searchAAPPolicyStatementsCached(query);
        return formatAAPPolicyStatements(result.data, query, result.metadata);
      } else {
        const result = await searchAAPGuidelinesCached(query);
        return formatAAPGuidelines(result.data, query, result.metadata);
      }
    } catch (error: any) {
      return createErrorResponse("searching pediatric guidelines", error);
    }
  },
);

server.tool(
  "search-pediatric-literature",
  "Search for research articles in major pediatric journals (Pediatrics, JAMA Pediatrics, etc.)",
  {
    query: z
      .string()
      .describe(
        "Medical topic or condition to search for in pediatric journals",
      ),
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
      const result = await searchPediatricJournalsCached(query, max_results);
      return formatPediatricJournals(result.data, query, result.metadata);
    } catch (error: any) {
      return createErrorResponse("searching pediatric literature", error);
    }
  },
);

server.tool(
  "get-child-health-statistics",
  "Get pediatric health statistics and indicators from WHO Global Health Observatory",
  {
    indicator: z
      .string()
      .describe(
        "Health indicator to search for (e.g., 'Child mortality', 'Infant mortality', 'Immunization')",
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
      const result = await getChildHealthIndicatorsCached(
        indicator,
        country,
        limit,
      );
      return formatChildHealthIndicators(
        result.data,
        indicator,
        country,
        result.metadata,
      );
    } catch (error: any) {
      return createErrorResponse("fetching child health statistics", error);
    }
  },
);

server.tool(
  "search-pediatric-drugs",
  "Search for drugs with pediatric labeling and dosing information from FDA database",
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
      const result = await searchPediatricDrugsCached(query, limit);
      return formatPediatricDrugs(result.data, query, result.metadata);
    } catch (error: any) {
      return createErrorResponse("searching pediatric drugs", error);
    }
  },
);

server.tool(
  "search-aap-guidelines",
  "Comprehensive search for AAP guidelines combining Bright Futures and Policy Statements",
  {
    query: z
      .string()
      .describe("Medical condition or topic to search for AAP guidelines"),
  },
  async ({ query }) => {
    try {
      const result = await searchAAPGuidelinesCached(query);
      return formatAAPGuidelines(result.data, query, result.metadata);
    } catch (error: any) {
      return createErrorResponse("searching AAP guidelines", error);
    }
  },
);

// stdio server
async function runStdio(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Medical MCP Server running on stdio");
}

// streamable-http server
async function runHttp(server: McpServer) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(cors());
  app.options("/mcp", cors());

  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(getArgValue("--port") ?? process.env.PORT ?? 3000);
  
  
  app.all("/mcp", async (req: any, res: any) => {
    
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
    
    res.on("close", async () => {
        try { await transport.close(); } catch {}
        try { await server.close(); } catch {}
      });

      await transport.handleRequest(req, res, req.body);

  });

  app.listen(port, host, () => {
    console.log(`✅ Medical MCP Server (HTTP) on http://${host}:${port}/mcp`);
  })
}

// main
async function main() {

  const useHttp = process.argv.includes("--http");
  if (useHttp) return runHttp(server);
  return runStdio(server);
  
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
