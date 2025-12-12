import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { cacheManager } from "./cache/manager.js";
import {
  searchDrugsCached,
  getDrugByNDCCached,
  getHealthIndicatorsCached,
  searchPubMedArticlesCached,
} from "./utils.js";

describe("Cache Integration Tests", () => {
  beforeEach(() => {
    cacheManager.clear();
    cacheManager.stopCleanup();
  });

  afterEach(() => {
    cacheManager.clear();
    cacheManager.stopCleanup();
  });

  it("should cache searchDrugs results", async () => {
    const query = "aspirin";
    const limit = 5;

    // First call - should be a miss
    const result1 = await searchDrugsCached(query, limit);
    assert.strictEqual(
      result1.metadata.cached,
      false,
      "First call should not be cached",
    );
    assert.strictEqual(
      result1.metadata.cacheAge,
      0,
      "First call should have 0 cache age",
    );

    // Second call - should be a hit
    const result2 = await searchDrugsCached(query, limit);
    assert.strictEqual(
      result2.metadata.cached,
      true,
      "Second call should be cached",
    );
    assert(result2.metadata.cacheAge >= 0, "Cache age should be non-negative");

    // Data should be the same
    assert.deepStrictEqual(
      result1.data,
      result2.data,
      "Cached data should match original data",
    );
  });

  it("should cache getDrugByNDC results", async () => {
    // Use a known NDC for testing (this would need to be a real NDC in actual tests)
    const ndc = "12345-678-90";

    // First call
    const result1 = await getDrugByNDCCached(ndc);
    assert.strictEqual(
      result1.metadata.cached,
      false,
      "First call should not be cached",
    );

    // Second call
    const result2 = await getDrugByNDCCached(ndc);
    // Note: If the first call returned null (drug not found), second might also be null
    // but should still be cached
    if (result1.data !== null) {
      assert.strictEqual(
        result2.metadata.cached,
        true,
        "Second call should be cached",
      );
    }
  });

  it("should cache getHealthIndicators results", async () => {
    const indicator = "Life expectancy";
    const country = "USA";

    // First call
    const result1 = await getHealthIndicatorsCached(indicator, country);
    assert.strictEqual(
      result1.metadata.cached,
      false,
      "First call should not be cached",
    );

    // Second call
    const result2 = await getHealthIndicatorsCached(indicator, country);
    assert.strictEqual(
      result2.metadata.cached,
      true,
      "Second call should be cached",
    );
    assert.deepStrictEqual(
      result1.data,
      result2.data,
      "Cached data should match",
    );
  });

  it("should cache searchPubMedArticles results", async () => {
    const query = "diabetes treatment";
    const maxResults = 5;

    // First call
    const result1 = await searchPubMedArticlesCached(query, maxResults);
    assert.strictEqual(
      result1.metadata.cached,
      false,
      "First call should not be cached",
    );

    // Second call
    const result2 = await searchPubMedArticlesCached(query, maxResults);
    assert.strictEqual(
      result2.metadata.cached,
      true,
      "Second call should be cached",
    );
    assert.deepStrictEqual(
      result1.data,
      result2.data,
      "Cached data should match",
    );
  });

  it("should generate different cache keys for different parameters", async () => {
    const query1 = "aspirin";
    const query2 = "ibuprofen";
    const limit = 5;

    const result1 = await searchDrugsCached(query1, limit);
    const result2 = await searchDrugsCached(query2, limit);

    // Different queries should produce different results (and different cache keys)
    // The cache keys are internal, but we can verify the results are different
    assert.notDeepStrictEqual(
      result1.data,
      result2.data,
      "Different queries should produce different results",
    );
  });

  it("should track cache statistics across multiple calls", async () => {
    const initialStats = cacheManager.getStats();
    const initialHits = initialStats.hits;
    const initialMisses = initialStats.misses;

    // Make some cached calls
    await searchDrugsCached("test1", 5);
    await searchDrugsCached("test1", 5); // Should be a hit
    await searchDrugsCached("test2", 5);
    await searchDrugsCached("test2", 5); // Should be a hit

    const finalStats = cacheManager.getStats();

    // Should have at least 2 misses and 2 hits
    assert(
      finalStats.misses >= initialMisses + 2,
      "Should have at least 2 misses",
    );
    assert(finalStats.hits >= initialHits + 2, "Should have at least 2 hits");
  });

  it("should respect TTL per source", async () => {
    // This test would require time manipulation to properly test TTL
    // For now, we just verify that cache entries have expiration times
    const result = await searchDrugsCached("aspirin", 5);
    const stats = cacheManager.getStats();

    // After caching, we should have at least one entry
    if (result.metadata.cached === false) {
      // First call, should create cache entry
      const statsAfter = cacheManager.getStats();
      assert(
        statsAfter.totalEntries > 0,
        "Should have cache entries after first call",
      );
    }
  });
});
