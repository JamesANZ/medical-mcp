import { logger } from "../logger.js";
import type { FanoutResult, SearchOpts, SourceAdapter } from "./types.js";

export async function fanoutSearch<T>(
  adapters: SourceAdapter<T>[],
  query: string,
  opts: SearchOpts = {},
): Promise<FanoutResult<T>> {
  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => ({
      source: adapter.name,
      items: await adapter.search(query, opts),
    })),
  );

  const items: T[] = [];
  const errors: FanoutResult<T>["errors"] = [];

  for (const [index, result] of settled.entries()) {
    const source = adapters[index]?.name || "unknown";
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
      continue;
    }
    const message =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    logger.warn("SourceFanout", `${source} failed: ${message}`);
    errors.push({ source, message });
  }

  return { items, errors };
}
