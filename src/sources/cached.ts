import { cacheManager } from "../cache/manager.js";

export interface CacheMetadata {
  cached: boolean;
  cacheAge: number;
}

export interface CachedResult<T> {
  data: T;
  metadata: CacheMetadata;
}

function cacheAge(timestamp: Date): number {
  return Math.floor((Date.now() - timestamp.getTime()) / 1000);
}

export async function cachedCall<T>(
  source: string,
  operation: string,
  params: Record<string, unknown>,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<CachedResult<T>> {
  const key = cacheManager.generateKey(source, operation, params);
  const cached = cacheManager.get(key);
  if (cached) {
    return {
      data: cached.data as T,
      metadata: { cached: true, cacheAge: cacheAge(cached.timestamp) },
    };
  }

  const data = await fn();
  cacheManager.set(key, data, ttlSeconds, source);
  return {
    data,
    metadata: { cached: false, cacheAge: 0 },
  };
}
