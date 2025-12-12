import { createHash } from "crypto";
import { getCacheConfig, type CacheConfig } from "./config.js";

export interface CacheEntry {
  data: any;
  timestamp: Date;
  expiresAt: Date;
  source: string;
  lastAccessed: Date;
}

export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  memoryUsageEstimate: number; // bytes
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private hits: number;
  private misses: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.config = getCacheConfig();
    this.hits = 0;
    this.misses = 0;
    this.cleanupInterval = null;

    // Start auto-cleanup if enabled
    if (this.config.enabled) {
      this.startCleanup();
    }
  }

  /**
   * Generate a cache key from source, operation, and parameters
   */
  generateKey(source: string, operation: string, params: any): string {
    // Create a stable string representation of params
    const paramsStr = JSON.stringify(params, Object.keys(params || {}).sort());
    const hash = createHash("sha256").update(paramsStr).digest("hex");
    return `${source}:${operation}:${hash.substring(0, 16)}`;
  }

  /**
   * Get a cached entry if it exists and is not expired
   */
  get(key: string): CacheEntry | null {
    if (!this.config.enabled) {
      return null;
    }

    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = new Date();
    this.hits++;
    return entry;
  }

  /**
   * Store data in cache with TTL
   */
  set(key: string, data: any, ttlSeconds: number, source: string): void {
    if (!this.config.enabled) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const entry: CacheEntry = {
      data,
      timestamp: now,
      expiresAt,
      source,
      lastAccessed: now,
    };

    // Check if we need to evict entries (LRU)
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  /**
   * Remove a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalEntries = this.cache.size;
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    const missRate =
      totalRequests > 0 ? (this.misses / totalRequests) * 100 : 0;

    // Estimate memory usage (rough calculation)
    let memoryUsageEstimate = 0;
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const entry of this.cache.values()) {
      // Rough estimate: JSON stringify size
      memoryUsageEstimate += JSON.stringify(entry.data).length;
      memoryUsageEstimate += 200; // Overhead for entry metadata

      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    return {
      totalEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      memoryUsageEstimate,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Sort entries by lastAccessed (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime(),
    );

    // Remove oldest 10% or enough to get below max size
    const toRemove = Math.max(
      Math.ceil(this.cache.size * 0.1),
      this.cache.size - this.config.maxSize + 1,
    );

    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Remove all expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(
        `🧹 Cache cleanup: Removed ${keysToDelete.length} expired entries`,
      );
    }
  }

  /**
   * Stop cleanup interval (useful for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
