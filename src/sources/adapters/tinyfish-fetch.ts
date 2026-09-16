import superagent from "superagent";
import {
  TINYFISH_API_KEY,
  TINYFISH_FETCH_API_BASE,
  USER_AGENT,
} from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { hasMonidKey, monidRun } from "../monid.js";
import { skippedHealth, timedHealthCheck } from "../http.js";
import { hasTinyFishKey } from "./tinyfish-search.js";
import type { LiteratureItem, SearchOpts, SourceAdapter } from "../types.js";

type FetchPage = {
  url?: string;
  title?: string;
  text?: string;
};

function extractFetchPages(output: unknown): FetchPage[] {
  if (!output) return [];
  if (Array.isArray(output)) return output as FetchPage[];
  if (typeof output === "object" && output && "results" in output) {
    const rows = (output as { results?: unknown }).results;
    return Array.isArray(rows) ? (rows as FetchPage[]) : [];
  }
  return [];
}

export async function fetchTinyFishPages(
  urls: string[],
  purpose?: string,
): Promise<FetchPage[]> {
  if (!hasTinyFishKey() || urls.length === 0) return [];
  const input = {
    urls: urls.slice(0, 10),
    format: "markdown",
    purpose:
      purpose ||
      "Extract medical product or guideline information from official pages",
  };
  try {
    if (hasMonidKey()) {
      const output = await monidRun(
        "tinyfish",
        "/fetch",
        { body: input },
        "MonidFetch",
      );
      return extractFetchPages(output);
    }
    const res = await resilientCall("TinyFishFetch", async () =>
      superagent
        .post(TINYFISH_FETCH_API_BASE)
        .send(input)
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .set("Content-Type", "application/json")
        .timeout({ response: 30_000, deadline: 45_000 }),
    );
    return extractFetchPages(res.body);
  } catch (error) {
    logger.warn(
      "TinyFishFetch",
      `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

async function searchViaFetch(
  query: string,
  opts: SearchOpts = {},
): Promise<LiteratureItem[]> {
  const url = opts.extra?.url ? String(opts.extra.url) : "";
  if (!url) return [];
  const pages = await fetchTinyFishPages(
    [url],
    String(opts.extra?.purpose || ""),
  );
  return pages.map((page) => ({
    source: "Monid TinyFish Fetch",
    title: page.title || query,
    abstract: page.text?.slice(0, 1000),
    url: page.url,
  }));
}

export const tinyFishFetchAdapter: SourceAdapter<LiteratureItem> = {
  id: "tinyfish-fetch",
  name: "Monid TinyFish Fetch",
  country: "INTL",
  domain: "literature",
  access: "rest",
  requiresKey: true,
  search: searchViaFetch,
  healthCheck: () => {
    if (!hasTinyFishKey()) {
      return Promise.resolve(skippedHealth("MONID_API_KEY not set"));
    }
    return timedHealthCheck(async () => {
      const pages = await fetchTinyFishPages(["https://www.tga.gov.au/"]);
      if (pages.length === 0) {
        throw new Error("Monid TinyFish fetch returned no pages");
      }
    });
  },
};
