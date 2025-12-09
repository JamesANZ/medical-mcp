/**
 * ICD-10/CPT Code Lookup Functions
 *
 * NOTE: This implementation requires licensing:
 * - NLM Clinical Tables API: Requires UMLS Terminology Services (UTS) account
 * - CPT Codes: Requires AMA (American Medical Association) licensing
 *
 * This is a placeholder implementation. Research and obtain necessary licenses before use.
 */

import superagent from "superagent";
import { USER_AGENT } from "../constants.js";
import { createMCPResponse } from "../utils.js";

// NOTE: These URLs require licensing - update after obtaining licenses
const ICD10_API_BASE = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search";
const CPT_API_BASE = "https://clinicaltables.nlm.nih.gov/api/cpt/v3/search";
// ICD-11: Consider using local database as WHO API is unstable

export interface ICD10Code {
  code: string;
  description: string;
  category?: string;
  parentCode?: string;
}

export interface CPTCode {
  code: string;
  description: string;
  category?: string;
}

/**
 * Search for ICD-10 codes
 * NOTE: Requires UMLS account/licensing
 */
export async function searchICD10Codes(
  query: string,
  limit: number = 20,
): Promise<ICD10Code[]> {
  // TODO: Implement after obtaining UMLS license
  // For now, return error message
  throw new Error(
    "ICD-10 code lookup requires UMLS Terminology Services (UTS) account. " +
    "Please research and obtain necessary licensing before using this feature. " +
    "See: https://www.nlm.nih.gov/research/umls/index.html"
  );

  /* Placeholder implementation (uncomment after licensing):
  try {
    const res = await superagent
      .get(ICD10_API_BASE)
      .query({
        terms: query,
        maxList: limit,
      })
      .set("User-Agent", USER_AGENT);

    // Parse response based on NLM API format
    const results = res.body[3] || []; // NLM API returns array with results at index 3

    return results.map((item: any[]) => ({
      code: item[0] || "",
      description: item[1] || "",
    }));
  } catch (error: any) {
    throw new Error(`Failed to search ICD-10 codes: ${error.message}`);
  }
  */
}

/**
 * Search for CPT codes
 * NOTE: Requires AMA licensing
 */
export async function searchCPTCodes(
  query: string,
  limit: number = 20,
): Promise<CPTCode[]> {
  // TODO: Implement after obtaining AMA license
  throw new Error(
    "CPT code lookup requires AMA (American Medical Association) licensing. " +
    "Please research and obtain necessary licensing before using this feature. " +
    "See: https://www.ama-assn.org/practice-management/cpt"
  );

  /* Placeholder implementation (uncomment after licensing):
  try {
    const res = await superagent
      .get(CPT_API_BASE)
      .query({
        terms: query,
        maxList: limit,
      })
      .set("User-Agent", USER_AGENT);

    const results = res.body[3] || [];

    return results.map((item: any[]) => ({
      code: item[0] || "",
      description: item[1] || "",
    }));
  } catch (error: any) {
    throw new Error(`Failed to search CPT codes: ${error.message}`);
  }
  */
}

/**
 * Format ICD-10 codes for display
 */
export function formatICD10Codes(codes: ICD10Code[], query: string): string {
  if (codes.length === 0) {
    return createMCPResponse(
      `No ICD-10 codes found for "${query}". Try different search terms.`,
    ).content[0].text;
  }

  let result = `**ICD-10 Code Search: "${query}"**\n\n`;
  result += `Found ${codes.length} code(s)\n\n`;

  codes.forEach((code, index) => {
    result += `${index + 1}. **${code.code}** - ${code.description}\n`;
    if (code.category) {
      result += `   Category: ${code.category}\n`;
    }
    result += "\n";
  });

  return result;
}

/**
 * Format CPT codes for display
 */
export function formatCPTCodes(codes: CPTCode[], query: string): string {
  if (codes.length === 0) {
    return createMCPResponse(
      `No CPT codes found for "${query}". Try different search terms.`,
    ).content[0].text;
  }

  let result = `**CPT Code Search: "${query}"**\n\n`;
  result += `Found ${codes.length} code(s)\n\n`;

  codes.forEach((code, index) => {
    result += `${index + 1}. **${code.code}** - ${code.description}\n`;
    if (code.category) {
      result += `   Category: ${code.category}\n`;
    }
    result += "\n";
  });

  return result;
}
