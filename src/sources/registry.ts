import type { SourceAdapter, SourceDomain } from "./types.js";

const adapters = new Map<string, SourceAdapter<unknown>>();

export function registerSource(adapter: SourceAdapter<unknown>): void {
  adapters.set(adapter.id, adapter);
}

export function getSource(id: string): SourceAdapter<unknown> | undefined {
  return adapters.get(id);
}

export function listSources(filter?: {
  domain?: SourceDomain;
  country?: string;
  countries?: string[];
}): SourceAdapter<unknown>[] {
  const all = Array.from(adapters.values());
  return all.filter((adapter) => {
    if (filter?.domain && adapter.domain !== filter.domain) return false;
    if (filter?.country && adapter.country !== filter.country) return false;
    if (
      filter?.countries &&
      filter.countries.length > 0 &&
      !filter.countries.includes(adapter.country)
    ) {
      return false;
    }
    return true;
  });
}

export function resetRegistry(): void {
  adapters.clear();
}
