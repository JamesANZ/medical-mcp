/**
 * Health.gov Topics Functions
 *
 * Integration with MyHealthfinder API for health topics and preventive services
 */

import superagent from "superagent";
import { HEALTH_GOV_API_BASE, USER_AGENT } from "../constants.js";
import { createMCPResponse } from "../utils.js";

export interface HealthTopic {
  id: string;
  title: string;
  description?: string;
  url?: string;
  category?: string;
}

export interface PreventiveService {
  id: string;
  title: string;
  description?: string;
  ageGroup?: string;
  frequency?: string;
  url?: string;
}

/**
 * Search for health topics from Health.gov
 */
export async function searchHealthTopics(
  query: string,
  limit: number = 20,
): Promise<HealthTopic[]> {
  try {
    // Get list of all topics
    const res = await superagent
      .get(`${HEALTH_GOV_API_BASE}/itemlist.json`)
      .query({
        Type: "topic",
      })
      .set("User-Agent", USER_AGENT);

    const topics = res.body.Items || [];

    // Filter by query (case-insensitive search in title)
    const queryLower = query.toLowerCase();
    const filtered = topics
      .filter((topic: any) =>
        topic.Title?.toLowerCase().includes(queryLower),
      )
      .slice(0, limit);

    return filtered.map((topic: any) => ({
      id: topic.Id || "",
      title: topic.Title || "",
      description: topic.Description,
      url: topic.Url,
      category: topic.Category,
    }));
  } catch (error: any) {
    throw new Error(`Failed to search health topics: ${error.message}`);
  }
}

/**
 * Get detailed information about a specific health topic
 */
export async function getHealthTopicDetails(
  topicId: string,
): Promise<HealthTopic | null> {
  try {
    const res = await superagent
      .get(`${HEALTH_GOV_API_BASE}/topicsearch.json`)
      .query({
        TopicId: topicId,
      })
      .set("User-Agent", USER_AGENT);

    const topic = res.body;

    if (!topic) {
      return null;
    }

    return {
      id: topic.Id || topicId,
      title: topic.Title || "",
      description: topic.Description || topic.Sections?.[0]?.Content,
      url: topic.Url,
      category: topic.Category,
    };
  } catch (error: any) {
    throw new Error(`Failed to get health topic details: ${error.message}`);
  }
}

/**
 * Format health topics for display
 */
export function formatHealthTopics(
  topics: HealthTopic[],
  query: string,
): string {
  if (topics.length === 0) {
    return createMCPResponse(
      `No health topics found for "${query}". Try different search terms.`,
    ).content[0].text;
  }

  let result = `**Health Topics Search: "${query}"**\n\n`;
  result += `Found ${topics.length} topic(s)\n\n`;

  topics.forEach((topic, index) => {
    result += `${index + 1}. **${topic.title}**\n`;
    if (topic.description) {
      result += `   ${topic.description.substring(0, 200)}${topic.description.length > 200 ? "..." : ""}\n`;
    }
    if (topic.url) {
      result += `   URL: ${topic.url}\n`;
    }
    result += "\n";
  });

  return result;
}

/**
 * Format health topic details for display
 */
export function formatHealthTopicDetails(topic: HealthTopic | null): string {
  if (!topic) {
    return createMCPResponse("Health topic not found.").content[0].text;
  }

  let result = `**Health Topic: ${topic.title}**\n\n`;

  if (topic.description) {
    result += `${topic.description}\n\n`;
  }

  if (topic.category) {
    result += `**Category:** ${topic.category}\n\n`;
  }

  if (topic.url) {
    result += `**More Information:** ${topic.url}\n`;
  }

  return result;
}
