/**
 * ICD-10/CPT Code Lookup Functions
 *
 * ICD-10: Uses NLM Clinical Tables API (public, no licensing required)
 *   - Works best with code prefixes (e.g., "E10", "I10")
 *   - Searches both codes and descriptions
 * 
 * CPT: Requires AMA licensing
 *   - CPT codes are proprietary to the American Medical Association
 *   - Provides helpful error messages with licensing information
 *   - Alternative: Use ICD-10-PCS or HCPCS Level II codes where applicable
 */

import superagent from "superagent";
import { USER_AGENT } from "../constants.js";
import { createMCPResponse } from "../utils.js";

// NLM Clinical Tables API (public, no licensing required)
const ICD10_API_BASE = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search";
// CPT codes are proprietary to AMA - using alternative lookup
const CPT_SEARCH_BASE = "https://www.ama-assn.org";

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
 * Search for ICD-10 codes using NLM Clinical Tables API
 * This API is public and does not require licensing
 */
export async function searchICD10Codes(
  query: string,
  limit: number = 20,
): Promise<ICD10Code[]> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Search query cannot be empty");
    }

    // The API works best with:
    // 1. ICD-10 code prefixes (e.g., "E11", "I10")
    // 2. Partial word matches in descriptions (e.g., "diabet" instead of "diabetes")
    // 3. The API searches both codes and descriptions
    const searchQuery = query.trim();
    
    const res = await superagent
      .get(ICD10_API_BASE)
      .query({
        terms: searchQuery,
        maxList: Math.min(limit, 50), // API max is 50
      })
      .set("User-Agent", USER_AGENT)
      .timeout(10000); // 10 second timeout

    // NLM API returns a JSON array:
    // [0] = number of results
    // [1] = search terms used
    // [2] = suggestions (if any)
    // [3] = array of results, where each result is [code, description]
    const response = res.body;

    if (!Array.isArray(response) || response.length < 4) {
      throw new Error("Invalid response format from ICD-10 API");
    }

    const results = response[3] || [];
    const numResults = response[0] || 0;
    const suggestions = response[2] || [];

    if (numResults === 0 || results.length === 0) {
      // If no results but we have suggestions, the API might need a different search format
      // The NLM API works best with:
      // - ICD-10 code prefixes (e.g., "E10", "I10", "J44")
      // - Partial word matches (though full words often don't work)
      // Return empty array - the formatter will handle the "no results" message
      return [];
    }

    return results.map((item: any[]) => {
      if (!Array.isArray(item) || item.length < 2) {
        return null;
      }
      return {
        code: String(item[0] || "").trim(),
        description: String(item[1] || "").trim(),
      };
    }).filter((item: ICD10Code | null): item is ICD10Code => item !== null);
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Failed to search ICD-10 codes: API returned ${error.response.status} - ${error.response.text}`,
      );
    }
    throw new Error(`Failed to search ICD-10 codes: ${error.message}`);
  }
}

/**
 * Search for CPT codes
 * 
 * NOTE: CPT codes are proprietary to the AMA. This implementation uses
 * a web scraping approach as a fallback. For production use, consider:
 * 1. Obtaining AMA CPT licensing
 * 2. Using a licensed CPT API service
 * 3. Maintaining a local CPT database with proper licensing
 * 
 * For now, this provides basic functionality but may have limitations.
 */
export async function searchCPTCodes(
  query: string,
  limit: number = 20,
): Promise<CPTCode[]> {
  try {
    if (!query || query.trim().length === 0) {
      throw new Error("Search query cannot be empty");
    }

    // Try to use a public CPT lookup service if available
    // Note: Most public services have limitations or require registration
    // This is a basic implementation - consider enhancing with proper licensing
    
    // Alternative: Use a free CPT lookup service (if available)
    // For now, we'll provide a helpful error message with guidance
    const queryLower = query.trim().toLowerCase();
    
    // Basic pattern matching for common CPT code formats (5 digits)
    const cptCodePattern = /^\d{5}$/;
    if (cptCodePattern.test(query.trim())) {
      // If user provided a CPT code directly, we can't look it up without licensing
      // But we can provide guidance
      throw new Error(
        "CPT code lookup requires AMA licensing. " +
        "CPT codes are proprietary to the American Medical Association. " +
        "For production use, please obtain proper licensing from AMA. " +
        "See: https://www.ama-assn.org/practice-management/cpt " +
        "\n\n" +
        "Alternative: Use ICD-10 procedure codes (ICD-10-PCS) which are public domain, " +
        "or consider using HCPCS Level II codes which are also available via NLM API."
      );
    }

    // For text-based searches, we can't provide results without licensing
    // Return a helpful message
    throw new Error(
      "CPT code search requires AMA (American Medical Association) licensing. " +
      "CPT codes are proprietary and cannot be searched without proper licensing. " +
      "\n\n" +
      "Options:\n" +
      "1. Obtain AMA CPT licensing: https://www.ama-assn.org/practice-management/cpt\n" +
      "2. Use ICD-10-PCS codes (public domain) for procedure coding\n" +
      "3. Use HCPCS Level II codes (available via NLM API) for certain procedures\n" +
      "\n" +
      "For the code you searched: \"" + query + "\", please consult a licensed CPT database."
    );
  } catch (error: any) {
    // Re-throw our custom errors
    if (error.message.includes("CPT code") || error.message.includes("AMA")) {
      throw error;
    }
    throw new Error(`Failed to search CPT codes: ${error.message}`);
  }
}

/**
 * Format ICD-10 codes for display
 */
export function formatICD10Codes(codes: ICD10Code[], query: string): string {
  if (codes.length === 0) {
    let message = `No ICD-10 codes found for "${query}".\n\n`;
    message += "**Tips for searching:**\n";
    message += "- Use ICD-10 code prefixes (e.g., 'E10' for Type 1 diabetes, 'I10' for hypertension)\n";
    message += "- Try partial word matches (e.g., 'diabet' instead of 'diabetes')\n";
    message += "- Search by code category (e.g., 'E' for endocrine, 'I' for circulatory)\n";
    message += "- The API works best with code-based searches\n\n";
    message += "**Common ICD-10 code prefixes:**\n";
    message += "- E00-E89: Endocrine, nutritional and metabolic diseases\n";
    message += "- I00-I99: Diseases of the circulatory system\n";
    message += "- J00-J99: Diseases of the respiratory system\n";
    message += "- K00-K95: Diseases of the digestive system\n";
    message += "- M00-M99: Diseases of the musculoskeletal system\n";
    return createMCPResponse(message).content[0].text;
  }

  let result = `**ICD-10 Code Search: "${query}"**\n\n`;
  result += `Found ${codes.length} code(s)\n\n`;

  codes.forEach((code, index) => {
    result += `${index + 1}. **${code.code}** - ${code.description}\n`;
    if (code.category) {
      result += `   Category: ${code.category}\n`;
    }
    if (code.parentCode) {
      result += `   Parent Code: ${code.parentCode}\n`;
    }
    result += "\n";
  });

  result += "\n**Note:** ICD-10-CM codes are from the National Library of Medicine Clinical Tables API.\n";
  result += "For official coding guidelines, consult the ICD-10-CM Official Guidelines for Coding and Reporting.\n";

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
