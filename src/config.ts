export interface ServerConfig {
  bindIP: string;
  port: number;
  allowExternal: boolean;
  mode: "stdio" | "http";
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
}

export const DEFAULT_CONFIG: ServerConfig = {
  bindIP: "127.0.0.1",
  port: 3000,
  allowExternal: false,
  mode: "stdio",
};

export const TOOLS_INFO: Record<string, ToolInfo> = {
  "search-drugs": {
    name: "search-drugs",
    description: "Search for drugs in FDA database",
    category: "Drug Information",
  },
  "get-drug-details": {
    name: "get-drug-details",
    description: "Get drug details by NDC code",
    category: "Drug Information",
  },
  "search-medical-literature": {
    name: "search-medical-literature",
    description: "Search medical literature in PubMed",
    category: "Medical Literature",
  },
  "search-google-scholar": {
    name: "search-google-scholar",
    description: "Search academic papers in Google Scholar",
    category: "Medical Literature",
  },
  "check-drug-interactions": {
    name: "check-drug-interactions",
    description: "Check for drug interactions",
    category: "Drug Safety",
  },
  "search-medical-databases": {
    name: "search-medical-databases",
    description: "Search across multiple medical databases",
    category: "Medical Literature",
  },
  "search-medical-journals": {
    name: "search-medical-journals",
    description: "Search top medical journals",
    category: "Medical Literature",
  },
  "search-drug-nomenclature": {
    name: "search-drug-nomenclature",
    description: "Search drug nomenclature in RxNorm",
    category: "Drug Information",
  },
  "get-health-statistics": {
    name: "get-health-statistics",
    description: "Get health statistics from WHO",
    category: "Health Statistics",
  },
  "get-article-details": {
    name: "get-article-details",
    description: "Get detailed article information by PMID",
    category: "Medical Literature",
  },
  "search-clinical-guidelines": {
    name: "search-clinical-guidelines",
    description: "Search for clinical guidelines",
    category: "Clinical Guidelines",
  },
  // PBS (Pharmaceutical Benefits Scheme) Tools
  "pbs-get-latest-schedule": {
    name: "pbs-get-latest-schedule",
    description: "Get current PBS schedule code",
    category: "Australian PBS",
  },
  "pbs-list-schedules": {
    name: "pbs-list-schedules",
    description: "List PBS schedules",
    category: "Australian PBS",
  },
  "pbs-get-item": {
    name: "pbs-get-item",
    description: "Get PBS item by code",
    category: "Australian PBS",
  },
  "pbs-search-item-overview": {
    name: "pbs-search-item-overview",
    description: "Search PBS items with filters",
    category: "Australian PBS",
  },
  "pbs-search": {
    name: "pbs-search",
    description: "General PBS API search",
    category: "Australian PBS",
  },
  "pbs-get-fees-for-item": {
    name: "pbs-get-fees-for-item",
    description: "Get PBS fees for specific items",
    category: "Australian PBS",
  },
  "pbs-list-dispensing-rules": {
    name: "pbs-list-dispensing-rules",
    description: "List PBS dispensing rules",
    category: "Australian PBS",
  },
  "pbs-get-organisation-for-item": {
    name: "pbs-get-organisation-for-item",
    description: "Get manufacturer info for item",
    category: "Australian PBS",
  },
  "pbs-get-copayments": {
    name: "pbs-get-copayments",
    description: "Get PBS copayment information",
    category: "Australian PBS",
  },
  "pbs-get-restrictions-for-item": {
    name: "pbs-get-restrictions-for-item",
    description: "Get PBS restriction details for item",
    category: "Australian PBS",
  },
  "pbs-get-schedule-effective-date": {
    name: "pbs-get-schedule-effective-date",
    description: "Get schedule effective dates",
    category: "Australian PBS",
  },
  "pbs-list-programs": {
    name: "pbs-list-programs",
    description: "List PBS programs",
    category: "Australian PBS",
  },
  "pbs-get-item-restrictions": {
    name: "pbs-get-item-restrictions",
    description: "Get detailed item restrictions",
    category: "Australian PBS",
  },
};

export const SAFETY_NOTICES = {
  GLOBAL: [
    "🚨 MEDICAL MCP SERVER - SAFETY NOTICE:",
    "This server provides medical information for educational purposes only.",
    "NEVER use this information as the sole basis for clinical decisions.",
    "Always consult qualified healthcare professionals for patient care.",
  ],
  DYNAMIC_DATA: [
    "📊 DYNAMIC DATA SOURCE NOTICE:",
    "This system queries live medical databases (FDA, WHO, PubMed, RxNorm, PBS)",
    "NO hardcoded medical data is used - all information is retrieved dynamically",
    "Data freshness depends on source database updates and API availability",
    "Network connectivity required for all medical information retrieval",
  ],
  EXTERNAL_ACCESS: "⚠️  WARNING: External access enabled - use with caution!",
  LOCALHOST_ONLY: "🔒 Security: Bound to localhost only (127.0.0.1)",
} as const;

export function parseServerConfig(args: string[]): ServerConfig {
  const config = { ...DEFAULT_CONFIG };

  // Parse mode
  config.mode = args.includes("--http") ? "http" : "stdio";

  // Parse port
  const portArg = args.find((arg) => arg.startsWith("--port="));
  if (portArg) {
    config.port = parseInt(portArg.split("=")[1]) || DEFAULT_CONFIG.port;
  }

  // Parse bind IP
  const bindArg = args.find((arg) => arg.startsWith("--bind="));
  if (bindArg) {
    config.bindIP = bindArg.split("=")[1];
  } else if (process.env.MCP_BIND_IP) {
    config.bindIP = process.env.MCP_BIND_IP;
  }

  // Parse external access
  config.allowExternal =
    args.includes("--allow-external") ||
    process.env.MCP_ALLOW_EXTERNAL === "true";

  return config;
}

export function displaySafetyNotices(): void {
  SAFETY_NOTICES.GLOBAL.forEach((line) => console.error(line));
  console.error("");
  SAFETY_NOTICES.DYNAMIC_DATA.forEach((line) => console.error(line));
  console.error("");
}

export function displayServerInfo(config: ServerConfig): void {
  if (config.mode === "http") {
    if (config.allowExternal) {
      console.error("🚨 MEDICAL MCP SERVER - EXTERNAL ACCESS MODE");
      console.error(SAFETY_NOTICES.EXTERNAL_ACCESS);
      console.error(`Binding to ${config.bindIP} (external access allowed)`);
    } else {
      console.error("🚨 MEDICAL MCP SERVER - LOCALHOST ONLY MODE");
      console.error("Binding to localhost only for security");
    }
    console.error(
      `Starting HTTP server on http://${config.bindIP}:${config.port}`,
    );
  } else {
    console.error("🚨 MEDICAL MCP SERVER - STDIO MODE");
    console.error("Using stdio transport (inherently localhost-only)");
  }
}

export function getServerInfo(config: ServerConfig) {
  return {
    name: "medical-mcp",
    version: "1.0.0",
    mode: config.allowExternal ? "external-access" : "localhost-only",
    security: config.allowExternal
      ? `bound to ${config.bindIP} (external access enabled)`
      : "bound to 127.0.0.1 only",
    tools: Object.keys(TOOLS_INFO),
  };
}
