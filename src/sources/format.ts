import { MCP_TOOL_NAMES } from "../mcp-tools.js";
import type { CacheMetadata } from "./cached.js";
import type {
  ClinicalTrial,
  FanoutError,
  RegulatoryProduct,
  SafetyEvent,
  SourceCatalogRow,
} from "./types.js";

function createMCPResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function appendCacheInfo(text: string, metadata?: CacheMetadata): string {
  if (!metadata) return text;
  if (metadata.cached) {
    return `${text}\n\n_Cached result (${metadata.cacheAge}s old)_`;
  }
  return text;
}

function appendErrors(text: string, errors: FanoutError[]): string {
  if (errors.length === 0) return text;
  const lines = errors.map((error) => `- ${error.source}: ${error.message}`);
  return `${text}\n\n**Source issues**\n${lines.join("\n")}`;
}

export function formatRegulatoryProducts(
  products: RegulatoryProduct[],
  query: string,
  errors: FanoutError[] = [],
  metadata?: CacheMetadata,
) {
  if (products.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        appendErrors(
          `No regulatory products found for "${query}" in the selected countries.`,
          errors,
        ),
        metadata,
      ),
    );
  }

  const byCountry = new Map<string, RegulatoryProduct[]>();
  for (const product of products) {
    const list = byCountry.get(product.country) || [];
    list.push(product);
    byCountry.set(product.country, list);
  }

  let text = `**International drug search for "${query}"**\n\n`;
  text += `Found ${products.length} product(s) across ${byCountry.size} jurisdiction(s).\n`;

  for (const [country, countryItems] of byCountry) {
    const bySource = new Map<string, RegulatoryProduct[]>();
    for (const item of countryItems) {
      const list = bySource.get(item.source) || [];
      list.push(item);
      bySource.set(item.source, list);
    }
    for (const [source, items] of bySource) {
      text += `\n## ${country} — ${source}\n\n`;
      items.forEach((item, index) => {
        text += `${index + 1}. **${item.productName}**\n`;
        if (item.activeIngredients.length > 0) {
          text += `   Ingredients: ${item.activeIngredients.join(", ")}\n`;
        }
        if (item.status) text += `   Status: ${item.status}\n`;
        if (item.identifier) {
          text += `   ${item.identifier.type}: ${item.identifier.value}\n`;
        }
        if (item.sponsor) text += `   Sponsor: ${item.sponsor}\n`;
        if (item.dosageForm) text += `   Form: ${item.dosageForm}\n`;
        if (item.route) text += `   Route: ${item.route}\n`;
        if (item.url) text += `   URL: ${item.url}\n`;
        text += "\n";
      });
    }
  }

  return createMCPResponse(
    appendCacheInfo(appendErrors(text, errors), metadata),
  );
}

export function formatSafetyEvents(
  events: SafetyEvent[],
  query: string,
  errors: FanoutError[] = [],
  metadata?: CacheMetadata,
) {
  if (events.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        appendErrors(`No safety records found for "${query}".`, errors),
        metadata,
      ),
    );
  }

  let text = `**Drug safety results for "${query}"**\n\n`;
  const byKind = new Map<string, number>();
  for (const event of events) {
    byKind.set(event.kind, (byKind.get(event.kind) || 0) + 1);
  }
  text += `Adverse events: ${byKind.get("adverse_event") || 0}. Recalls: ${byKind.get("recall") || 0}. Shortages: ${byKind.get("shortage") || 0}.\n`;
  if (!byKind.get("shortage")) {
    text += `No shortage records were returned for this query.\n`;
  }
  text += "\n";
  events.forEach((event, index) => {
    text += `${index + 1}. **[${event.kind}] ${event.title}**\n`;
    text += `   Source: ${event.source} (${event.country})\n`;
    if (event.id) text += `   Report ID: ${event.id}\n`;
    if (event.date) text += `   Date: ${event.date}\n`;
    if (event.summary) text += `   ${event.summary}\n`;
    if (event.url) text += `   URL: ${event.url}\n`;
    text += "\n";
  });

  return createMCPResponse(
    appendCacheInfo(appendErrors(text, errors), metadata),
  );
}

export function formatClinicalTrials(
  trials: ClinicalTrial[],
  query: string,
  errors: FanoutError[] = [],
  metadata?: CacheMetadata,
) {
  if (trials.length === 0) {
    return createMCPResponse(
      appendCacheInfo(
        appendErrors(`No clinical trials found for "${query}".`, errors),
        metadata,
      ),
    );
  }

  let text = `**Clinical trials for "${query}"**\n\n`;
  trials.forEach((trial, index) => {
    text += `${index + 1}. **${trial.title}**\n`;
    text += `   Source: ${trial.source}\n`;
    if (trial.id) text += `   ID: ${trial.id}\n`;
    if (trial.status) text += `   Status: ${trial.status}\n`;
    if (trial.sponsor) text += `   Sponsor: ${trial.sponsor}\n`;
    if (trial.startDate) text += `   Start: ${trial.startDate}\n`;
    if (trial.summary) {
      const summary =
        trial.summary.length > 280
          ? `${trial.summary.slice(0, 280)}...`
          : trial.summary;
      text += `   ${summary}\n`;
    }
    if (trial.url) text += `   URL: ${trial.url}\n`;
    text += "\n";
  });

  return createMCPResponse(
    appendCacheInfo(appendErrors(text, errors), metadata),
  );
}

export function formatSourceCatalog(rows: SourceCatalogRow[]) {
  let text = `**MCP tools on this server (${MCP_TOOL_NAMES.length})**\n\n`;
  text += MCP_TOOL_NAMES.map((name) => `- \`${name}\``).join("\n");
  text += `\n\n**Medical sources (${rows.length})**\n\n`;
  text +=
    "Full catalog of registry adapters and dedicated-tool sources. `search-drugs` fans out to the five regulators only. If a tool name below is missing from your client, reload/enable the medical-mcp server — these tools are registered on the server process.\n\n";
  for (const row of rows) {
    text += `- **${row.name}** (\`${row.id}\`) — ${row.country} / ${row.domain} / ${row.access}`;
    if (row.requiresKey) text += " [API key optional]";
    if (!row.exposed) {
      text += " — not directly exposed";
    } else if (row.tools.length > 0) {
      text += ` — tools: ${row.tools.map((tool) => `\`${tool}\``).join(", ")}`;
    }
    text += "\n";
  }
  return createMCPResponse(text);
}
