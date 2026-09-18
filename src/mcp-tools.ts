/** MCP tools registered on this server. Keep in sync with `server.tool(...)` in index.ts. */
export const MCP_TOOL_NAMES = [
  "search-drugs",
  "search-drug-safety",
  "search-clinical-trials",
  "list-sources",
  "get-health-statistics",
  "search-medical-literature",
  "get-article-details",
  "search-drug-nomenclature",
  "search-google-scholar",
  "search-clinical-guidelines",
  "search-medical-journals",
  "get-cache-stats",
  "health-check",
  "search-pediatric-guidelines",
  "search-pediatric-literature",
  "search-pediatric-drugs",
] as const;
