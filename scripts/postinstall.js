#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const CONFIG_FILE_NAME = "claude_desktop_config.json";
const CONFIG_DIR = join(homedir(), "Library", "Application Support", "Claude");
const CONFIG_PATH = join(CONFIG_DIR, CONFIG_FILE_NAME);

// Get the package directory path (this script is in scripts/, so go up one level)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = dirname(__dirname); // Go up from scripts/ to package root

// For local installations, use node with the build path
const MCP_SERVER_CONFIG = {
  mcpServers: {
    "medical-mcp": {
      command: "node",
      args: [join(packageDir, "build", "index.js")],
    },
  },
};

function createClaudeConfig() {
  try {
    console.log("🔧 Configuring Claude Desktop for medical-mcp...");

    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
      console.log(`📁 Created Claude config directory: ${CONFIG_DIR}`);
    }

    let existingConfig = {};

    // Read existing config if it exists
    if (existsSync(CONFIG_PATH)) {
      try {
        const configContent = readFileSync(CONFIG_PATH, "utf8");
        existingConfig = JSON.parse(configContent);
        console.log("📖 Found existing Claude Desktop configuration");
      } catch (error) {
        console.log("⚠️  Could not parse existing config, creating new one");
        existingConfig = {};
      }
    }

    // Merge with existing MCP servers
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        ...MCP_SERVER_CONFIG.mcpServers,
      },
    };

    // Write the updated config
    writeFileSync(CONFIG_PATH, JSON.stringify(mergedConfig, null, 2));

    console.log("✅ Successfully configured Claude Desktop!");
    console.log(`📄 Config file: ${CONFIG_PATH}`);
    console.log(
      "🔄 Please restart Claude Desktop to use the medical-mcp server",
    );
    console.log("");
    console.log("📋 Available medical tools:");
    console.log("  • search-drugs - Search FDA drug database");
    console.log("  • search-medical-literature - Search PubMed articles");
    console.log("  • search-drug-nomenclature - Search RxNorm database");
    console.log("  • search-google-scholar - Search Google Scholar");
    console.log("  • search-clinical-guidelines - Search medical guidelines");
    // REMOVED: check-drug-interactions (dangerous false negatives)
    console.log("  • search-medical-databases - Comprehensive medical search");
    console.log("  • search-medical-journals - Search top medical journals");
    console.log("  • get-health-statistics - Get WHO health statistics");
    console.log("  • search-dental-procedures - Search dental procedures");
    console.log("  • search-dental-anatomy - Search dental anatomy");
    console.log("  • search-dental-materials - Search dental materials");
    console.log("  • search-dental-terminology - Search dental terminology");
    console.log(
      "  • search-dental-insurance-codes - Search dental insurance codes",
    );
    console.log("  • get-dental-categories - Get dental procedure categories");
    console.log("  • search-pbs-items - Search Australian PBS database");
    console.log("  • get-pbs-item - Get PBS item details");
    console.log("  • search-pbs-general - General PBS search");
    console.log("  • get-latest-pbs-schedule - Get latest PBS schedule");
    console.log("  • list-pbs-schedules - List PBS schedules");
    console.log("  • get-pbs-fees - Get PBS fees for items");
    console.log("  • get-pbs-restrictions - Get PBS restrictions");
    console.log("  • get-pbs-copayments - Get PBS copayment info");
    console.log("  • get-pbs-statistics - Get PBS statistics");
    console.log("  • list-pbs-programs - List PBS programs");
    console.log("  • list-pbs-dispensing-rules - List dispensing rules");
    console.log("  • get-pbs-organisation - Get manufacturer info");
    console.log("  • get-pbs-schedule-effective-date - Get schedule dates");
    console.log("  • clear-pbs-cache - Clear PBS data cache");
    console.log("");
    console.log("💡 Example usage in Claude:");
    console.log('  "Search for information about insulin in the FDA database"');
    console.log('  "Find recent research articles about diabetes treatment"');
    console.log(
      '  "Check for drug interactions between metformin and aspirin"',
    );
    console.log('  "Search for dental procedures related to root canals"');
    console.log('  "Find PBS information for paracetamol"');
  } catch (error) {
    console.error("❌ Error configuring Claude Desktop:", error.message);
    console.log("");
    console.log("🔧 Manual configuration:");
    console.log("1. Open Claude Desktop");
    console.log("2. Go to Settings > Developer");
    console.log("3. Add MCP server:");
    console.log("   Name: medical-mcp");
    console.log("   Command: node");
    console.log(`   Args: [\"${join(packageDir, "build", "index.js")}\"]`);
    console.log("4. Restart Claude Desktop");
    process.exit(1);
  }
}

// Only run if this is a postinstall script
if (process.env.npm_lifecycle_event === "postinstall") {
  createClaudeConfig();
}
