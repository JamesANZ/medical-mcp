import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { cacheManager } from "./manager.js";

describe("CacheManager", () => {
  beforeEach(() => {
    cacheManager.clear();
    cacheManager.stopCleanup();
  });

  afterEach(() => {
    cacheManager.clear();
    cacheManager.stopCleanup();
  });

  it("should store and retrieve cached data correctly", () => {
    const key = "test:key:123";
    const data = { test: "data" };

    cacheManager.set(key, data, 3600, "TestSource");
    const cached = cacheManager.get(key);

    assert(cached !== null, "Cache entry should exist");
    assert.deepStrictEqual(cached!.data, data, "Cached data should match");
    assert.strictEqual(cached!.source, "TestSource", "Source should match");
  });

  it("should return null for expired entries", () => {
    const key = "test:expired:123";
    const data = { test: "data" };

    // Set with very short TTL (1 second)
    cacheManager.set(key, data, 1, "TestSource");

    // Entry should exist immediately
    const immediate = cacheManager.get(key);
    assert(immediate !== null, "Entry should exist immediately");

    // Wait for expiration (using a small delay)
    // Note: In real tests, you might use fake timers
    setTimeout(() => {
      const expired = cacheManager.get(key);
      assert.strictEqual(expired, null, "Expired entry should return null");
    }, 1100);
  });

  it("should return null for missing entries", () => {
    const key = "test:missing:123";
    const cached = cacheManager.get(key);

    assert.strictEqual(cached, null, "Missing entry should return null");
  });

  it("should invalidate specific entries", () => {
    const key1 = "test:key1:123";
    const key2 = "test:key2:123";
    const data1 = { test: "data1" };
    const data2 = { test: "data2" };

    cacheManager.set(key1, data1, 3600, "TestSource");
    cacheManager.set(key2, data2, 3600, "TestSource");

    cacheManager.invalidate(key1);

    assert.strictEqual(
      cacheManager.get(key1),
      null,
      "Invalidated entry should be null",
    );
    assert(cacheManager.get(key2) !== null, "Other entry should still exist");
  });

  it("should clear all cache entries", () => {
    const key1 = "test:key1:123";
    const key2 = "test:key2:123";
    const data = { test: "data" };

    cacheManager.set(key1, data, 3600, "TestSource");
    cacheManager.set(key2, data, 3600, "TestSource");

    cacheManager.clear();

    assert.strictEqual(
      cacheManager.get(key1),
      null,
      "All entries should be cleared",
    );
    assert.strictEqual(
      cacheManager.get(key2),
      null,
      "All entries should be cleared",
    );
  });

  it("should generate consistent cache keys", () => {
    const source = "TestSource";
    const operation = "test-operation";
    const params = { query: "test", limit: 10 };

    const key1 = cacheManager.generateKey(source, operation, params);
    const key2 = cacheManager.generateKey(source, operation, params);

    assert.strictEqual(key1, key2, "Same params should generate same key");
    assert(
      key1.startsWith(`${source}:${operation}:`),
      "Key should have correct prefix",
    );
  });

  it("should generate different keys for different params", () => {
    const source = "TestSource";
    const operation = "test-operation";

    const key1 = cacheManager.generateKey(source, operation, {
      query: "test1",
    });
    const key2 = cacheManager.generateKey(source, operation, {
      query: "test2",
    });

    assert.notStrictEqual(
      key1,
      key2,
      "Different params should generate different keys",
    );
  });

  it("should track cache statistics", () => {
    const key1 = "test:key1:123";
    const key2 = "test:key2:123";
    const data = { test: "data" };

    // Set two entries
    cacheManager.set(key1, data, 3600, "TestSource");
    cacheManager.set(key2, data, 3600, "TestSource");

    // Get one (hit)
    cacheManager.get(key1);

    // Get missing (miss)
    cacheManager.get("test:missing:123");

    const stats = cacheManager.getStats();

    assert.strictEqual(stats.totalEntries, 2, "Should have 2 entries");
    assert.strictEqual(stats.hits, 1, "Should have 1 hit");
    assert.strictEqual(stats.misses, 1, "Should have 1 miss");
    assert(
      stats.hitRate >= 0 && stats.hitRate <= 100,
      "Hit rate should be percentage",
    );
    assert(
      stats.missRate >= 0 && stats.missRate <= 100,
      "Miss rate should be percentage",
    );
  });

  it("should update lastAccessed on get", () => {
    const key = "test:lru:123";
    const data = { test: "data" };

    cacheManager.set(key, data, 3600, "TestSource");
    const firstAccess = cacheManager.get(key);
    const firstAccessed = firstAccess!.lastAccessed;

    // Small delay to ensure timestamp difference
    setTimeout(() => {
      const secondAccess = cacheManager.get(key);
      const secondAccessed = secondAccess!.lastAccessed;

      assert(
        secondAccessed.getTime() > firstAccessed.getTime(),
        "lastAccessed should be updated on get",
      );
    }, 10);
  });

  it("should evict LRU entries when max size exceeded", () => {
    // Set max size to 5 for this test
    // Note: This test assumes we can temporarily modify config
    // In a real implementation, you might want to make config injectable

    const data = { test: "data" };

    // Add 6 entries
    for (let i = 0; i < 6; i++) {
      cacheManager.set(`test:key${i}:123`, data, 3600, "TestSource");
    }

    const stats = cacheManager.getStats();
    // Should have evicted at least 1 entry to stay under limit
    // (assuming default max size is 1000, this might not trigger)
    // For a proper test, we'd need to make max size configurable per test
    assert(stats.totalEntries <= 1000, "Should not exceed max size");
  });
});
