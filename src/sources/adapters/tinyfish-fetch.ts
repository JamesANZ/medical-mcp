import superagent from "superagent";
import {
  TINYFISH_API_KEY,
  TINYFISH_FETCH_API_BASE,
  USER_AGENT,
} from "../../constants.js";
import { logger } from "../../logger.js";
import { resilientCall } from "../../resilience/index.js";
import { skippedHealth, timedHealthCheck } from "../http.js";
import { hasTinyFishKey } from "./tinyfish-search.js";
import type { LiteratureItem, SearchOpts, SourceAdapter } from "../types.js";

type FetchPage = {
  url?: string;
  title?: string;
  text?: string;
};

export async function fetchTinyFishPages(
  urls: string[],
  purpose?: string,
): Promise<FetchPage[]> {
  if (!hasTinyFishKey() || urls.length === 0) return [];
  try {
    const res = await resilientCall("TinyFishFetch", async () =>
      superagent
        .post(TINYFISH_FETCH_API_BASE)
        .send({
          urls: urls.slice(0, 10),
          format: "markdown",
          purpose:
            purpose ||
            "Extract medical product or guideline information from official pages",
        })
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .set("Content-Type", "application/json")
        .timeout({ response: 30_000, deadline: 45_000 }),
    );
    return (res.body?.results || []) as FetchPage[];
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
  const pages = await fetchTinyFishPages([url], String(opts.extra?.purpose || ""));
  return pages.map((page) => ({
    source: "TinyFish Fetch",
    title: page.title || query,
    abstract: page.text?.slice(0, 1000),
    url: page.url,
  }));
}

export const tinyFishFetchAdapter: SourceAdapter<LiteratureItem> = {
  id: "tinyfish-fetch",
  name: "TinyFish Fetch",
  country: "INTL",
  domain: "literature",
  access: "rest",
  requiresKey: true,
  search: searchViaFetch,
  healthCheck: () => {
    if (!hasTinyFishKey()) {
      return Promise.resolve(skippedHealth("TINYFISH_API_KEY not set"));
    }
    return timedHealthCheck(async () => {
      await superagent
        .post(TINYFISH_FETCH_API_BASE)
        .send({ urls: ["https://www.tga.gov.au/"], format: "markdown" })
        .set("User-Agent", USER_AGENT)
        .set("X-API-Key", TINYFISH_API_KEY)
        .set("Content-Type", "application/json")
        .timeout({ response: 15_000, deadline: 20_000 });
    });
  },
};
