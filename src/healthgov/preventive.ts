/**
 * Health.gov Preventive Services Functions
 *
 * Get preventive service recommendations based on patient demographics
 */

import superagent from "superagent";
import { HEALTH_GOV_API_BASE, USER_AGENT } from "../constants.js";
import { createMCPResponse } from "../utils.js";

export interface PreventiveService {
  id: string;
  title: string;
  description?: string;
  ageGroup?: string;
  frequency?: string;
  url?: string;
  category?: string;
}

/**
 * Get preventive services recommendations
 * Based on age, sex, pregnancy status, sexual activity, and tobacco use
 */
export async function getPreventiveServices(params: {
  age?: number;
  sex?: "male" | "female";
  pregnant?: boolean;
  sexuallyActive?: boolean;
  tobaccoUse?: boolean;
}): Promise<PreventiveService[]> {
  try {
    const queryParams: Record<string, string> = {};

    if (params.age !== undefined) {
      queryParams.age = params.age.toString();
    }

    if (params.sex) {
      queryParams.sex = params.sex;
    }

    if (params.pregnant !== undefined) {
      queryParams.pregnant = params.pregnant ? "yes" : "no";
    }

    if (params.sexuallyActive !== undefined) {
      queryParams.sexuallyActive = params.sexuallyActive ? "yes" : "no";
    }

    if (params.tobaccoUse !== undefined) {
      queryParams.tobaccoUse = params.tobaccoUse ? "yes" : "no";
    }

    const res = await superagent
      .get(`${HEALTH_GOV_API_BASE}/myhealthfinder.json`)
      .query(queryParams)
      .set("User-Agent", USER_AGENT);

    const services = res.body.Results?.Resources?.Resource || [];

    return services.map((service: any) => ({
      id: service.Id || "",
      title: service.Title || "",
      description: service.Description,
      ageGroup: service.Age,
      frequency: service.Frequency,
      url: service.AccessibleVersion || service.Url,
      category: service.Type,
    }));
  } catch (error: any) {
    throw new Error(
      `Failed to get preventive services: ${error.message}`,
    );
  }
}

/**
 * Format preventive services for display
 */
export function formatPreventiveServices(
  services: PreventiveService[],
  params: {
    age?: number;
    sex?: string;
  },
): string {
  if (services.length === 0) {
    return createMCPResponse(
      `No preventive services found for the specified criteria.`,
    ).content[0].text;
  }

  let result = `**Preventive Services Recommendations**\n\n`;

  if (params.age !== undefined) {
    result += `Age: ${params.age} years\n`;
  }
  if (params.sex) {
    result += `Sex: ${params.sex}\n`;
  }
  result += `\nFound ${services.length} recommendation(s)\n\n`;

  services.forEach((service, index) => {
    result += `${index + 1}. **${service.title}**\n`;
    if (service.description) {
      result += `   ${service.description.substring(0, 200)}${service.description.length > 200 ? "..." : ""}\n`;
    }
    if (service.ageGroup) {
      result += `   Age Group: ${service.ageGroup}\n`;
    }
    if (service.frequency) {
      result += `   Frequency: ${service.frequency}\n`;
    }
    if (service.url) {
      result += `   URL: ${service.url}\n`;
    }
    result += "\n";
  });

  result +=
    "\n**Note:** These are general recommendations. Consult with your healthcare provider for personalized preventive care.\n";

  return result;
}
