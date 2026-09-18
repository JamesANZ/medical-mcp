import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createErrorResponse,
  formatHealthIndicators,
  formatPubMedArticles,
  formatGoogleScholarArticles,
  formatMedicalJournalsSearch,
  formatArticleDetails,
  formatRxNormDrugs,
  formatClinicalGuidelines,
  formatBrightFuturesGuidelines,
  formatAAPPolicyStatements,
  formatPediatricJournals,
  formatPediatricDrugs,
  formatAAPGuidelines,
  logSafetyWarnings,
  getHealthIndicatorsCached,
  searchPubMedArticlesCached,
  getPubMedArticleByPMIDCached,
  searchRxNormDrugsCached,
  searchGoogleScholarCached,
  searchClinicalGuidelinesCached,
  searchMedicalJournalsCached,
  searchBrightFuturesGuidelinesCached,
  searchAAPPolicyStatementsCached,
  searchPediatricJournalsCached,
  searchPediatricDrugsCached,
  searchAAPGuidelinesCached,
  getSourceHealth,
  isValidPmid,
} from "./utils.js";
import { cacheManager } from "./cache/manager.js";
import {
  catalogSources,
  searchDrugSafety,
  searchInternationalDrugs,
  searchInternationalTrials,
} from "./sources/index.js";
import {
  formatClinicalTrials,
  formatRegulatoryProducts,
  formatSafetyEvents,
  formatSourceCatalog,
} from "./sources/format.js";
import { MONID_API_KEY } from "./constants.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import express from "express";
import cors from "cors";

logSafetyWarnings();

// get arguments
function getArgValue(prefix: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const [, value] = arg.split("=", 2);
  return value;
}

const server = new McpServer({
  name: "medical-mcp",
  version: "2.1.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// MCP Tools
server.tool(
  "search-drugs",
  'Search national drug regulators (FDA, DailyMed, TGA, Health Canada, EMA). Defaults to US, AU, CA, and EU. Pass countries: ["US"] for FDA/DailyMed only.',
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
      .describe("Number of results to return per source (max 50)"),
    countries: z
      .array(z.string())
      .optional()
      .describe(
        "Jurisdiction codes to search: US, AU, CA, EU. Unsupported codes return an error. Defaults to all first-wave regulators.",
      ),
  },
  async ({ query, limit, countries }) => {
    try {
      const result = await searchInternationalDrugs(query, limit, countries);
      return formatRegulatoryProducts(
        result.data.items,
        query,
        result.data.errors,
        result.metadata,
      );
    } catch (error: any) {
      return createErrorResponse("searching drugs", error);
    }
  },
);

server.tool(
  "search-drug-safety",
  "Search pharmacovigilance data: FDA FAERS adverse events, recalls, and drug shortages",
  {
    query: z.string().describe("Drug name to search for safety records"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .default(10)
      .describe("Number of results to return per safety source"),
  },
  async ({ query, limit }) => {
    try {
      const result = await searchDrugSafety(query, limit);
      return formatSafetyEvents(
        result.data.items,
        query,
        result.data.errors,
        result.metadata,
      );
    } catch (error: any) {
      return createErrorResponse("searching drug safety", error);
    }
  },
);

server.tool(
  "search-clinical-trials",
  "Search ClinicalTrials.gov for trials by condition, intervention, or drug",
  {
    query: z.string().describe("Condition, intervention, or drug to search"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .default(10)
      .describe("Number of results to return"),
  },
  async ({ query, limit }) => {
    try {
      const result = await searchInternationalTrials(query, limit);
      return formatClinicalTrials(
        result.data.items,
        query,
        result.data.errors,
        result.metadata,
      );
    } catch (error: any) {
      return createErrorResponse("searching clinical trials", error);
    }
  },
);

server.tool(
  "list-sources",
  "List medical data sources and which MCP tools reach them. Includes registry adapters and dedicated-tool sources (WHO, PubMed, RxNorm, Scholar). Not limited to the search-drugs regulator fanout.",
  {},
  async () => {
    try {
      return formatSourceCatalog(catalogSources());
    } catch (error: any) {
      return createErrorResponse("listing sources", error);
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
  "Get detailed information about a specific medical article by PMID. Full text is attached only when the PMC record's PMID/DOI matches this article.",
  {
    pmid: z.string().describe("PubMed ID (PMID) of the article"),
  },
  async ({ pmid }) => {
    try {
      if (!isValidPmid(pmid)) {
        return createErrorResponse(
          "fetching article details",
          new Error(
            `Invalid PMID "${pmid}". A PMID must be 1–10 digits, e.g. 42742671.`,
          ),
        );
      }
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
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(25)
      .describe("Maximum number of RxNorm concepts to return (max 50)"),
  },
  async ({ query, limit }) => {
    try {
      const result = await searchRxNormDrugsCached(query, limit);
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

// Health Check Tool
server.tool(
  "health-check",
  "Check the health and availability of all upstream data sources (FDA, TGA, Health Canada, EMA, PubMed, WHO, RxNorm, ClinicalTrials, Semantic Scholar, TinyFish). Reports build string, latency, circuit breaker states, and cache health.",
  {},
  async () => {
    try {
      const health = await getSourceHealth();

      let text = `**Medical MCP Server Health Check**\n`;
      text += `Build: \`${health.build}\`\n\n`;

      // Source availability
      text += `## Data Sources\n\n`;
      const statusEmoji: Record<string, string> = {
        healthy: "✅",
        degraded: "⚠️",
        down: "❌",
      };
      for (const source of health.sources) {
        text += `${statusEmoji[source.status] || "❓"} **${source.source}**: ${source.status}`;
        if (source.latencyMs !== undefined) {
          text += ` (${source.latencyMs}ms)`;
        }
        if (source.error) {
          text += ` — ${source.error}`;
        }
        text += `\n`;
      }

      text += `\nScraped sources (Google Scholar, AAP) are reached via TinyFish when MONID_API_KEY is set; they are not pinged separately.\n`;

      // NCBI API key
      text += `\n## Configuration\n\n`;
      text += `NCBI API Key: ${health.ncbiApiKey ? "✅ Configured (10 req/sec PubMed)" : "❌ Not set (3 req/sec PubMed — set NCBI_API_KEY for 3x throughput)"}\n`;
      text += `Monid API Key: ${health.monidApiKey || MONID_API_KEY ? "✅ Configured (TinyFish search/fetch via Monid)" : "❌ Not set — Scholar/AAP use Semantic Scholar or skip. Set MONID_API_KEY at https://app.monid.ai/access/api-keys"}\n`;

      // Circuit breakers
      if (health.circuitBreakers.length > 0) {
        text += `\n## Circuit Breakers\n\n`;
        for (const cb of health.circuitBreakers) {
          const cbEmoji =
            cb.state === "CLOSED"
              ? "✅"
              : cb.state === "HALF_OPEN"
                ? "⚠️"
                : "❌";
          text += `${cbEmoji} **${cb.name}**: ${cb.state}`;
          if (cb.failureCount > 0) {
            text += ` (${cb.failureCount} failures)`;
          }
          text += `\n`;
        }
      }

      // Cache
      text += `\n## Cache\n\n`;
      text += `Entries: ${health.cache.totalEntries}\n`;
      text += `Hit Rate: ${health.cache.hitRate}%\n`;
      text += `Memory: ${(health.cache.memoryUsageEstimate / 1024 / 1024).toFixed(2)} MB\n`;

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (error: any) {
      return createErrorResponse("running health check", error);
    }
  },
);

// Pediatric Source Tools
server.tool(
  "search-pediatric-guidelines",
  "Search AAP pediatric guidelines. Policy statements and clinical reports come from PubMed (Pediatrics / AAP corporate author). Bright Futures and publications.aap.org web hits are kept only if the URL is on an AAP host with a real article path.",
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
      return formatPediatricDrugs(
        result.data.drugs,
        query,
        result.metadata,
        result.data.labelsRetrieved,
      );
    } catch (error: any) {
      return createErrorResponse("searching pediatric drugs", error);
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
      try {
        await transport.close();
      } catch {}
      try {
        await server.close();
      } catch {}
    });

    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, host, () => {
    console.error(`✅ Medical MCP Server (HTTP) on http://${host}:${port}/mcp`);
  });
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
