import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  checkDrugInteractions,
  searchMedicalDatabases,
  searchMedicalJournals,
  searchUpToDate,
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
  formatUpToDateResults,
} from "./utils.js";

const server = new McpServer({
  name: "medical-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

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

server.tool(
  "search-uptodate",
  "Search UpToDate clinical decision support system for evidence-based medical information and expert recommendations",
  {
    query: z
      .string()
      .describe(
        "Medical topic, condition, or clinical question to search in UpToDate",
      ),
    api_key: z
      .string()
      .optional()
      .describe(
        "UpToDate API key for enterprise access (optional - will use web scraping if not provided)",
      ),
  },
  async ({ query, api_key }) => {
    try {
      const results = await searchUpToDate(query, api_key);
      return formatUpToDateResults(results, query);
    } catch (error: any) {
      return createErrorResponse("searching UpToDate", error);
    }
  },
);

async function main() {
  // Check for command line arguments to determine transport type
  const args = process.argv.slice(2);
  const useHttp = args.includes("--http");
  const port = parseInt(
    args.find((arg) => arg.startsWith("--port="))?.split("=")[1] || "3000",
  );

  if (useHttp) {
    // HTTP Server with localhost-only binding
    console.error("🚨 MEDICAL MCP SERVER - LOCALHOST ONLY MODE");
    console.error("Binding to localhost only for security");
    console.error(`Starting HTTP server on http://localhost:${port}`);

    // Create HTTP server with localhost-only binding
    const http = await import("http");
    const httpServer = http.createServer((req, res) => {
      // Security: Only allow localhost connections
      const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
      const isLocalhost =
        clientIP === "127.0.0.1" ||
        clientIP === "::1" ||
        clientIP === "::ffff:127.0.0.1" ||
        req.headers.host?.startsWith("localhost:") ||
        req.headers.host?.startsWith("127.0.0.1:");

      if (!isLocalhost) {
        console.error(
          `🚨 BLOCKED: Non-localhost connection attempt from ${clientIP}`,
        );
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Access denied: This server is restricted to localhost only");
        return;
      }

      // Set CORS headers for localhost only
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Basic MCP server info endpoint
      if (req.url === "/info") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            name: "medical-mcp",
            version: "1.0.0",
            mode: "localhost-only",
            security: "bound to 127.0.0.1 only",
            tools: [
              "search-drugs",
              "get-drug-details",
              "get-health-statistics",
              "search-medical-literature",
              "get-article-details",
              "search-drug-nomenclature",
              "search-google-scholar",
              "search-clinical-guidelines",
              "check-drug-interactions",
              "search-medical-databases",
              "search-medical-journals",
              "search-uptodate",
            ],
          }),
        );
        return;
      }

      // Default response
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(
        "Medical MCP Server - Localhost Only Mode\nUse stdio transport for full MCP functionality.",
      );
    });

    // Bind to localhost only (127.0.0.1)
    httpServer.listen(port, "127.0.0.1", () => {
      console.error(
        `✅ Medical MCP Server running on http://localhost:${port}`,
      );
      console.error("🔒 Security: Bound to localhost only (127.0.0.1)");
      console.error("📝 Info endpoint: http://localhost:" + port + "/info");
      console.error("⚠️  Note: Use stdio transport for full MCP functionality");
    });

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.error("\n🛑 Shutting down Medical MCP Server...");
      httpServer.close(() => {
        console.error("✅ Server stopped");
        process.exit(0);
      });
    });
  } else {
    // Default stdio transport (already localhost-only)
    console.error("🚨 MEDICAL MCP SERVER - STDIO MODE");
    console.error("Using stdio transport (inherently localhost-only)");

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("✅ Medical MCP Server running on stdio");
    console.error("🔒 Security: Stdio transport is inherently localhost-only");
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
