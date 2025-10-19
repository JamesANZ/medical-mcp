import {
  PBSSchedule,
  PBSItem,
  PBSRestriction,
  PBSCopayment,
  PBSFee,
  PBSProgram,
  PBSOrganisation,
  PBSSearchResult,
} from "./types.js";
import superagent from "superagent";
import {
  PBS_API_BASE,
  USER_AGENT,
  PBS_API_KEY,
  PBS_REQUIRES_AUTH,
} from "./constants.js";

// PBS Rate Limiter - Enforces 1 request per 20 seconds limit
class PBSRateLimiter {
  private lastRequest: number = 0;
  private readonly minInterval = 20000; // 20 seconds in milliseconds

  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(
        `⏳ PBS Rate Limiting: Waiting ${Math.ceil(waitTime / 1000)}s before next request`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequest = Date.now();
  }
}

// PBS Cache Manager - Caches data for 30 days since PBS updates monthly
interface PBSCache {
  [key: string]: { data: any; timestamp: number };
}

class PBSCacheManager {
  private cache: PBSCache = {};
  private readonly TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  get(key: string): any | null {
    const item = this.cache[key];
    if (item && Date.now() - item.timestamp < this.TTL) {
      console.log(`📋 PBS Cache Hit: ${key}`);
      return item.data;
    }
    console.log(`📋 PBS Cache Miss: ${key}`);
    return null;
  }

  set(key: string, data: any): void {
    this.cache[key] = { data, timestamp: Date.now() };
    console.log(`📋 PBS Cache Set: ${key}`);
  }

  clear(): void {
    this.cache = {};
    console.log("📋 PBS Cache Cleared");
  }
}

// Global instances
export const pbsRateLimiter = new PBSRateLimiter();
export const pbsCache = new PBSCacheManager();

// PBS Authentication Helper
function logPBSAuthStatus(): void {
  if (PBS_API_KEY === "2384af7c667342ceb5a736fe29f1dc6b") {
    console.log("🔓 Using PBS Public API (unregistered user subscription key)");
  } else if (PBS_API_KEY) {
    console.log("🔑 Using PBS API with custom authentication");
  } else {
    console.log("⚠️  PBS API requires authentication - no API key found");
    console.log(
      "📝 Please set PBS_API_KEY or PBS_SUBSCRIPTION_KEY environment variable",
    );
    console.log(
      "🔗 Register for API access at: https://data.pbs.gov.au/api/pbs-api.html",
    );
  }
}

// Generic PBS API Call Function
async function makePBSAPICall(
  endpoint: string,
  queryParams: any = {},
): Promise<any> {
  // Log authentication status
  logPBSAuthStatus();

  // Apply rate limiting
  await pbsRateLimiter.waitForRateLimit();

  // Build request with authentication
  let request = superagent
    .get(`${PBS_API_BASE}${endpoint}`)
    .query(queryParams)
    .set("User-Agent", USER_AGENT)
    .timeout(30000);

  // Add API key if available
  if (PBS_API_KEY) {
    request = request.set("Subscription-Key", PBS_API_KEY);
  }

  const res = await request;
  return res.body;
}

// PBS (Pharmaceutical Benefits Scheme) Functions

export async function getLatestPBSSchedule(): Promise<PBSSchedule | null> {
  try {
    // Check cache first
    const cacheKey = "latest-schedule";
    const cached = pbsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Make authenticated API call
    const response = await makePBSAPICall("/schedules", {
      limit: 1,
      sort: "desc",
      sort_fields: "effective_date",
    });

    const schedules = response.data || [];
    const result = schedules.length > 0 ? schedules[0] : null;

    // Cache the result
    if (result) {
      pbsCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.error("Error fetching latest PBS schedule:", error);
    return null;
  }
}

export async function listPBSSchedules(): Promise<PBSSchedule[]> {
  try {
    const response = await makePBSAPICall("/schedules", {
      limit: 50,
      sort: "desc",
      sort_fields: "effective_date",
    });
    return response.data || [];
  } catch (error) {
    console.error("Error listing PBS schedules:", error);
    return [];
  }
}

export async function getPBSItem(itemCode: string): Promise<PBSItem | null> {
  try {
    const response = await makePBSAPICall(`/items/${itemCode}`);
    return response || null;
  } catch (error) {
    console.error(`Error fetching PBS item ${itemCode}:`, error);
    return null;
  }
}

export async function searchPBSItems(
  itemName?: string,
  manufacturer?: string,
  scheduleCode?: string,
  limit: number = 20,
): Promise<PBSSearchResult[]> {
  try {
    const queryParams: any = { limit };

    if (itemName) queryParams.itemName = itemName;
    if (manufacturer) queryParams.manufacturer = manufacturer;
    if (scheduleCode) queryParams.scheduleCode = scheduleCode;

    const response = await makePBSAPICall("/item-overview", {
      ...queryParams,
      get_latest_schedule_only: true,
    });
    return response.data || [];
  } catch (error) {
    console.error("Error searching PBS items:", error);
    return [];
  }
}

export async function searchPBSGeneral(
  query: string,
  limit: number = 20,
): Promise<PBSSearchResult[]> {
  try {
    // Get all items from latest schedule and filter client-side
    const response = await makePBSAPICall("/item-overview", {
      get_latest_schedule_only: true,
      limit: 1000, // Get more items to filter
    });

    const allItems = response.data || [];

    // Filter items that contain the query in drug name, brand name, or other relevant fields
    const filteredItems = allItems.filter((item: any) => {
      const searchFields = [
        item.drug_name?.toLowerCase(),
        item.brand_name?.toLowerCase(),
        item.li_drug_name?.toLowerCase(),
        item.schedule_form?.toLowerCase(),
      ].filter(Boolean);

      const queryLower = query.toLowerCase();
      return searchFields.some((field) => field.includes(queryLower));
    });

    return filteredItems.slice(0, limit);
  } catch (error) {
    console.error("Error performing general PBS search:", error);
    return [];
  }
}

export async function getPBSFeesForItem(itemCode: string): Promise<PBSFee[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/fees`)
      .query({ itemCode })
      .set("User-Agent", USER_AGENT);

    return res.body.fees || [];
  } catch (error) {
    console.error(`Error fetching PBS fees for item ${itemCode}:`, error);
    return [];
  }
}

export async function listPBSDispensingRules(): Promise<any[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/parameters`)
      .query({ type: "dispensing" })
      .set("User-Agent", USER_AGENT);

    return res.body.parameters || [];
  } catch (error) {
    console.error("Error listing PBS dispensing rules:", error);
    return [];
  }
}

export async function getPBSOrganisationForItem(
  itemCode: string,
): Promise<PBSOrganisation | null> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/organisations`)
      .query({ itemCode })
      .set("User-Agent", USER_AGENT);

    const organisations = res.body.organisations || [];
    return organisations.length > 0 ? organisations[0] : null;
  } catch (error) {
    console.error(
      `Error fetching PBS organisation for item ${itemCode}:`,
      error,
    );
    return null;
  }
}

export async function getPBSCopayments(): Promise<PBSCopayment[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/copayments`)
      .set("User-Agent", USER_AGENT);

    return res.body.copayments || [];
  } catch (error) {
    console.error("Error fetching PBS copayments:", error);
    return [];
  }
}

export async function getPBSRestrictionsForItem(
  itemCode: string,
): Promise<PBSRestriction[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/restrictions`)
      .query({ itemCode })
      .set("User-Agent", USER_AGENT);

    return res.body.restrictions || [];
  } catch (error) {
    console.error(
      `Error fetching PBS restrictions for item ${itemCode}:`,
      error,
    );
    return [];
  }
}

export async function getPBSScheduleEffectiveDate(
  scheduleCode: string,
): Promise<string | null> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/schedules/${scheduleCode}`)
      .set("User-Agent", USER_AGENT);

    return res.body.effectiveDate || null;
  } catch (error) {
    console.error(
      `Error fetching PBS schedule effective date for ${scheduleCode}:`,
      error,
    );
    return null;
  }
}

export async function listPBSPrograms(): Promise<PBSProgram[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/programs`)
      .set("User-Agent", USER_AGENT);

    return res.body.programs || [];
  } catch (error) {
    console.error("Error listing PBS programs:", error);
    return [];
  }
}

export async function getPBSItemRestrictions(
  itemCode: string,
): Promise<PBSRestriction[]> {
  try {
    const res = await superagent
      .get(`${PBS_API_BASE}/restrictions`)
      .query({ itemCode })
      .set("User-Agent", USER_AGENT);

    return res.body.restrictions || [];
  } catch (error) {
    console.error(
      `Error fetching detailed PBS restrictions for item ${itemCode}:`,
      error,
    );
    return [];
  }
}

// Helper function for creating MCP responses
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

// PBS Formatting Functions

export function formatLatestPBSSchedule(schedule: PBSSchedule | null) {
  if (!schedule) {
    return createMCPResponse("No PBS schedule data available.");
  }

  let result = `**🇦🇺 Latest PBS Schedule Information**\n\n`;
  result += `**Schedule Code:** ${schedule.schedule_code}\n`;
  result += `**Effective Date:** ${schedule.effective_date}\n`;
  result += `**Effective Month:** ${schedule.effective_month}\n`;
  result += `**Effective Year:** ${schedule.effective_year}\n`;
  result += `**Publication Status:** ${schedule.publication_status}\n`;
  result += `**Revision Number:** ${schedule.revision_number}\n`;

  result += `\n📝 **Note:** PBS schedules are updated monthly on the first day of each month.`;

  return createMCPResponse(result);
}

export function formatPBSSchedules(schedules: PBSSchedule[]) {
  if (schedules.length === 0) {
    return createMCPResponse("No PBS schedules found.");
  }

  let result = `**🇦🇺 PBS Schedules**\n\n`;
  result += `Found ${schedules.length} schedule(s)\n\n`;

  schedules.forEach((schedule, index) => {
    result += `${index + 1}. **${schedule.schedule_code}**\n`;
    result += `   Effective Date: ${schedule.effective_date}\n`;
    result += `   Effective Month: ${schedule.effective_month}\n`;
    result += `   Effective Year: ${schedule.effective_year}\n`;
    result += `   Publication Status: ${schedule.publication_status}\n`;
    result += `   Revision Number: ${schedule.revision_number}\n`;
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSItem(item: PBSItem | null, itemCode: string) {
  if (!item) {
    return createMCPResponse(`No PBS item found with code: ${itemCode}`);
  }

  let result = `**🇦🇺 PBS Item Details: ${itemCode}**\n\n`;
  result += `**Item Name:** ${item.itemName}\n`;
  result += `**Manufacturer:** ${item.manufacturer}\n`;
  result += `**Strength:** ${item.strength}\n`;
  result += `**Pack Size:** ${item.packSize}\n`;
  result += `**Unit of Measure:** ${item.unitOfMeasure}\n`;
  result += `**Schedule Code:** ${item.scheduleCode}\n`;
  result += `**Effective Date:** ${item.effectiveDate}\n`;

  if (item.atcCode) {
    result += `**ATC Code:** ${item.atcCode}\n`;
  }
  if (item.maxQuantity) {
    result += `**Max Quantity:** ${item.maxQuantity}\n`;
  }
  if (item.maxRepeats) {
    result += `**Max Repeats:** ${item.maxRepeats}\n`;
  }
  if (item.restrictionCode) {
    result += `**Restriction Code:** ${item.restrictionCode}\n`;
  }

  return createMCPResponse(result);
}

export function formatPBSSearchResults(
  items: PBSSearchResult[],
  query: string,
) {
  if (items.length === 0) {
    return createMCPResponse(
      `No PBS items found for "${query}". Try a different search term.`,
    );
  }

  let result = `**🇦🇺 PBS Search Results: "${query}"**\n\n`;
  result += `Found ${items.length} item(s)\n\n`;

  items.forEach((item, index) => {
    result += `${index + 1}. **${item.drug_name || item.brand_name}**\n`;
    result += `   PBS Code: ${item.pbs_code}\n`;
    result += `   Brand Name: ${item.brand_name}\n`;
    result += `   Drug Name: ${item.drug_name}\n`;
    result += `   Form: ${item.li_form}\n`;
    result += `   Pack Size: ${item.pack_size}\n`;
    result += `   Schedule Code: ${item.schedule?.schedule_code || 'N/A'}\n`;
    result += `   Effective Date: ${item.schedule?.effective_date || 'N/A'}\n`;
    if (item.restrictionCode) {
      result += `   Restriction Code: ${item.restrictionCode}\n`;
    }
    if (item.copayment) {
      result += `   Copayment: $${item.copayment.toFixed(2)}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSFees(fees: PBSFee[], itemCode: string) {
  if (fees.length === 0) {
    return createMCPResponse(`No PBS fees found for item: ${itemCode}`);
  }

  let result = `**🇦🇺 PBS Fees for Item: ${itemCode}**\n\n`;
  result += `Found ${fees.length} fee(s)\n\n`;

  fees.forEach((fee, index) => {
    result += `${index + 1}. **${fee.feeType}**\n`;
    result += `   Amount: $${fee.amount.toFixed(2)}\n`;
    result += `   Effective Date: ${fee.effectiveDate}\n`;
    if (fee.description) {
      result += `   Description: ${fee.description}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSCopayments(copayments: PBSCopayment[]) {
  if (copayments.length === 0) {
    return createMCPResponse("No PBS copayment information available.");
  }

  let result = `**🇦🇺 PBS Copayment Information**\n\n`;
  result += `Found ${copayments.length} copayment type(s)\n\n`;

  copayments.forEach((copayment, index) => {
    result += `${index + 1}. **${copayment.concessionType}**\n`;
    result += `   Copayment Amount: $${copayment.copaymentAmount.toFixed(2)}\n`;
    result += `   Effective Date: ${copayment.effectiveDate}\n`;
    if (copayment.description) {
      result += `   Description: ${copayment.description}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSRestrictions(
  restrictions: PBSRestriction[],
  itemCode?: string,
) {
  if (restrictions.length === 0) {
    const itemText = itemCode ? ` for item: ${itemCode}` : "";
    return createMCPResponse(`No PBS restrictions found${itemText}.`);
  }

  const title = itemCode
    ? `PBS Restrictions for Item: ${itemCode}`
    : "PBS Restrictions";
  let result = `**🇦🇺 ${title}**\n\n`;
  result += `Found ${restrictions.length} restriction(s)\n\n`;

  restrictions.forEach((restriction, index) => {
    result += `${index + 1}. **${restriction.restrictionCode}**\n`;
    result += `   Type: ${restriction.restrictionType}\n`;
    result += `   Description: ${restriction.description}\n`;
    result += `   Effective Date: ${restriction.effectiveDate}\n`;
    if (restriction.clinicalCriteria) {
      result += `   Clinical Criteria: ${restriction.clinicalCriteria}\n`;
    }
    if (restriction.prescribingCriteria) {
      result += `   Prescribing Criteria: ${restriction.prescribingCriteria}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSPrograms(programs: PBSProgram[]) {
  if (programs.length === 0) {
    return createMCPResponse("No PBS programs found.");
  }

  let result = `**🇦🇺 PBS Programs**\n\n`;
  result += `Found ${programs.length} program(s)\n\n`;

  programs.forEach((program, index) => {
    result += `${index + 1}. **${program.programName}**\n`;
    result += `   Program Code: ${program.programCode}\n`;
    result += `   Effective Date: ${program.effectiveDate}\n`;
    result += `   Status: ${program.status}\n`;
    if (program.description) {
      result += `   Description: ${program.description}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSOrganisation(
  organisation: PBSOrganisation | null,
  itemCode: string,
) {
  if (!organisation) {
    return createMCPResponse(`No PBS organisation found for item: ${itemCode}`);
  }

  let result = `**🇦🇺 PBS Organisation for Item: ${itemCode}**\n\n`;
  result += `**Organisation Name:** ${organisation.organisationName}\n`;
  result += `**Organisation Code:** ${organisation.organisationCode}\n`;
  result += `**Type:** ${organisation.organisationType}\n`;

  if (organisation.address) {
    result += `**Address:** ${organisation.address}\n`;
  }
  if (organisation.contactInfo) {
    result += `**Contact Info:** ${organisation.contactInfo}\n`;
  }

  return createMCPResponse(result);
}

export function formatPBSDispensingRules(rules: any[]) {
  if (rules.length === 0) {
    return createMCPResponse("No PBS dispensing rules found.");
  }

  let result = `**🇦🇺 PBS Dispensing Rules**\n\n`;
  result += `Found ${rules.length} rule(s)\n\n`;

  rules.forEach((rule, index) => {
    result += `${index + 1}. **${rule.parameterName || rule.name || "Rule"}**\n`;
    result += `   Type: ${rule.type || "Dispensing"}\n`;
    if (rule.description) {
      result += `   Description: ${rule.description}\n`;
    }
    if (rule.value) {
      result += `   Value: ${rule.value}\n`;
    }
    if (rule.effectiveDate) {
      result += `   Effective Date: ${rule.effectiveDate}\n`;
    }
    result += "\n";
  });

  return createMCPResponse(result);
}

export function formatPBSScheduleEffectiveDate(
  effectiveDate: string | null,
  scheduleCode: string,
) {
  if (!effectiveDate) {
    return createMCPResponse(
      `No effective date found for PBS schedule: ${scheduleCode}`,
    );
  }

  let result = `**🇦🇺 PBS Schedule Effective Date**\n\n`;
  result += `**Schedule Code:** ${scheduleCode}\n`;
  result += `**Effective Date:** ${effectiveDate}\n`;

  return createMCPResponse(result);
}
