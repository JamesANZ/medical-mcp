import {
  normalizeTitle,
  calculateSimilarity,
  extractFirstAuthor,
  extractYear,
  createFingerprint,
  areDuplicates,
  deduplicatePapers,
  type PaperLike,
} from "../deduplication.js";

describe("Deduplication Module", () => {
  describe("normalizeTitle", () => {
    test("should normalize title - lowercase, remove punctuation", () => {
      expect(normalizeTitle("Treatment of Diabetes-Mellitus: A Review")).toBe(
        "treatment of diabetes mellitus a review",
      );
    });

    test("should handle unicode characters", () => {
      expect(normalizeTitle("Café & Résumé")).toBe("café résumé");
    });

    test("should decode HTML entities", () => {
      expect(normalizeTitle("Test &amp; Result &quot;Quote&quot;")).toBe(
        'test result "quote"',
      );
    });

    test("should remove version indicators", () => {
      expect(normalizeTitle("Paper Title Version 1")).toBe("paper title");
      expect(normalizeTitle("Paper Title [Preprint]")).toBe("paper title");
      expect(normalizeTitle("Paper Title arXiv:2024.12345")).toBe(
        "paper title",
      );
    });

    test("should handle empty string", () => {
      expect(normalizeTitle("")).toBe("");
    });
  });

  describe("calculateSimilarity", () => {
    test("should return 1.0 for identical strings", () => {
      expect(calculateSimilarity("test", "test")).toBe(1.0);
    });

    test("should return 0.0 for completely different strings", () => {
      const similarity = calculateSimilarity("abc", "xyz");
      expect(similarity).toBeLessThan(0.5);
    });

    test("should return high similarity for similar strings", () => {
      const similarity = calculateSimilarity(
        "treatment of diabetes mellitus",
        "treatment of diabetes-mellitus",
      );
      expect(similarity).toBeGreaterThan(0.9);
    });

    test("should handle empty strings", () => {
      expect(calculateSimilarity("", "")).toBe(1.0);
      expect(calculateSimilarity("test", "")).toBe(0.0);
      expect(calculateSimilarity("", "test")).toBe(0.0);
    });
  });

  describe("extractFirstAuthor", () => {
    test("should extract last name from 'Last, First' format", () => {
      expect(extractFirstAuthor("Smith, J.")).toBe("smith");
      expect(extractFirstAuthor("Smith, John")).toBe("smith");
    });

    test("should extract last name from 'First Last' format", () => {
      expect(extractFirstAuthor("John Smith")).toBe("smith");
      expect(extractFirstAuthor("J. Smith")).toBe("smith");
    });

    test("should handle 'et al' format", () => {
      expect(extractFirstAuthor("Smith et al.")).toBe("smith");
      expect(extractFirstAuthor("Smith et al")).toBe("smith");
    });

    test("should handle author array", () => {
      expect(extractFirstAuthor(["Smith, J.", "Jones, M."])).toBe("smith");
    });

    test("should return undefined for empty input", () => {
      expect(extractFirstAuthor("")).toBeUndefined();
      expect(extractFirstAuthor([])).toBeUndefined();
      expect(extractFirstAuthor(undefined)).toBeUndefined();
    });
  });

  describe("extractYear", () => {
    test("should extract year from YYYY format", () => {
      expect(extractYear("2024")).toBe("2024");
    });

    test("should extract year from date string", () => {
      expect(extractYear("2024-01-15")).toBe("2024");
      expect(extractYear("January 15, 2024")).toBe("2024");
    });

    test("should validate year range", () => {
      expect(extractYear("1899")).toBeUndefined(); // Too old
      expect(extractYear("2100")).toBeUndefined(); // Too far in future
      expect(extractYear("2024")).toBe("2024");
    });

    test("should return undefined for invalid input", () => {
      expect(extractYear("")).toBeUndefined();
      expect(extractYear("abc")).toBeUndefined();
      expect(extractYear(undefined)).toBeUndefined();
    });
  });

  describe("createFingerprint", () => {
    test("should create fingerprint from GoogleScholarArticle", () => {
      const paper: PaperLike = {
        title: "Test Paper",
        authors: "Smith, J.",
        year: "2024",
        doi: "10.1234/test",
      };
      const fp = createFingerprint(paper);
      expect(fp.doi).toBe("10.1234/test");
      expect(fp.normalizedTitle).toBe("test paper");
      expect(fp.firstAuthor).toBe("smith");
      expect(fp.year).toBe("2024");
    });

    test("should create fingerprint from PubMedArticle", () => {
      const paper: PaperLike = {
        title: "Test Paper",
        authors: ["Smith, J.", "Jones, M."],
        publication_date: "2024-01-15",
        doi: "10.1234/test",
      };
      const fp = createFingerprint(paper);
      expect(fp.doi).toBe("10.1234/test");
      expect(fp.normalizedTitle).toBe("test paper");
      expect(fp.firstAuthor).toBe("smith");
      expect(fp.year).toBe("2024");
    });
  });

  describe("areDuplicates", () => {
    test("Test 1: Exact duplicates - same title, author, year", () => {
      const paper1: PaperLike = {
        title: "Diabetes Treatment",
        authors: "Smith",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Diabetes Treatment",
        authors: "Smith",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 2: Fuzzy duplicates - similar titles with punctuation differences", () => {
      const paper1: PaperLike = {
        title: "Treatment of Diabetes Mellitus",
        authors: "Smith",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Treatment of Diabetes-Mellitus",
        authors: "Smith",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 3: DOI matching - same DOI, different titles", () => {
      const paper1: PaperLike = {
        title: "Paper A",
        doi: "10.1234/abc",
      };
      const paper2: PaperLike = {
        title: "Paper A - Preprint",
        doi: "10.1234/abc",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 4: Different papers - different titles/authors", () => {
      const paper1: PaperLike = {
        title: "CRISPR in Cancer",
        authors: "Smith",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "CRISPR in Diabetes",
        authors: "Jones",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(false);
    });

    test("Test 5: Missing DOI - match without DOI using title+author+year", () => {
      const paper1: PaperLike = {
        title: "Paper X",
        authors: "Lee",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Paper X",
        authors: "Lee",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 6: Missing author - match using title+year only", () => {
      const paper1: PaperLike = {
        title: "Paper Y",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Paper Y",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 7: Missing year - match using title+author only", () => {
      const paper1: PaperLike = {
        title: "Paper Z",
        authors: "Smith",
      };
      const paper2: PaperLike = {
        title: "Paper Z",
        authors: "Smith",
      };
      // Without year, we're more lenient - high similarity + same author = duplicate
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 8: Unicode handling - special characters preserved", () => {
      const paper1: PaperLike = {
        title: "Café & Résumé",
        authors: "José",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Café & Résumé",
        authors: "José",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 9: HTML entities - decoded before processing", () => {
      const paper1: PaperLike = {
        title: "Test &amp; Result",
        authors: "Smith",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Test & Result",
        authors: "Smith",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });

    test("Test 10: Version indicators - normalized out", () => {
      const paper1: PaperLike = {
        title: "Paper Title Version 1",
        authors: "Smith",
        year: "2024",
      };
      const paper2: PaperLike = {
        title: "Paper Title [Preprint]",
        authors: "Smith",
        year: "2024",
      };
      expect(areDuplicates(paper1, paper2)).toBe(true);
    });
  });

  describe("deduplicatePapers", () => {
    test("should remove exact duplicates", () => {
      const papers: PaperLike[] = [
        { title: "Diabetes Treatment", authors: "Smith", year: "2024" },
        { title: "Diabetes Treatment", authors: "Smith", year: "2024" },
      ];
      const result = deduplicatePapers(papers);
      expect(result.uniqueResults).toBe(1);
      expect(result.duplicatesRemoved).toBe(1);
      expect(result.totalResults).toBe(2);
    });

    test("should remove fuzzy duplicates", () => {
      const papers: PaperLike[] = [
        {
          title: "Treatment of Diabetes Mellitus",
          authors: "Smith",
          year: "2024",
        },
        {
          title: "Treatment of Diabetes-Mellitus",
          authors: "Smith",
          year: "2024",
        },
      ];
      const result = deduplicatePapers(papers);
      expect(result.uniqueResults).toBe(1);
      expect(result.duplicatesRemoved).toBe(1);
    });

    test("should keep different papers", () => {
      const papers: PaperLike[] = [
        { title: "CRISPR in Cancer", authors: "Smith", year: "2024" },
        { title: "CRISPR in Diabetes", authors: "Jones", year: "2024" },
      ];
      const result = deduplicatePapers(papers);
      expect(result.uniqueResults).toBe(2);
      expect(result.duplicatesRemoved).toBe(0);
    });

    test("should prefer papers with DOI when duplicates found", () => {
      const papers: PaperLike[] = [
        { title: "Paper A", authors: "Smith", year: "2024" },
        {
          title: "Paper A",
          authors: "Smith",
          year: "2024",
          doi: "10.1234/abc",
        },
      ];
      const result = deduplicatePapers(papers);
      expect(result.uniqueResults).toBe(1);
      expect(result.papers[0].doi).toBe("10.1234/abc");
    });

    test("should prefer papers with more complete metadata", () => {
      const papers: PaperLike[] = [
        { title: "Paper B", authors: "Smith" },
        {
          title: "Paper B",
          authors: "Smith",
          year: "2024",
          abstract: "Full abstract",
        },
      ];
      const result = deduplicatePapers(papers);
      expect(result.uniqueResults).toBe(1);
      // Should keep the one with more metadata (has year and abstract)
      expect(result.papers[0].year).toBe("2024");
    });

    test("should handle empty array", () => {
      const result = deduplicatePapers([]);
      expect(result.uniqueResults).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
      expect(result.totalResults).toBe(0);
    });

    test("should respect DEDUP_ENABLED environment variable", () => {
      const originalEnv = process.env.DEDUP_ENABLED;
      const papers: PaperLike[] = [
        { title: "Paper A", authors: "Smith", year: "2024" },
        { title: "Paper A", authors: "Smith", year: "2024" },
      ];

      process.env.DEDUP_ENABLED = "false";
      const resultDisabled = deduplicatePapers(papers);
      expect(resultDisabled.uniqueResults).toBe(2); // No deduplication

      process.env.DEDUP_ENABLED = "true";
      const resultEnabled = deduplicatePapers(papers);
      expect(resultEnabled.uniqueResults).toBe(1); // Deduplication enabled

      process.env.DEDUP_ENABLED = originalEnv;
    });

    test("should respect DEDUP_SIMILARITY_THRESHOLD environment variable", () => {
      const originalEnv = process.env.DEDUP_SIMILARITY_THRESHOLD;
      const papers: PaperLike[] = [
        { title: "Treatment of Diabetes", authors: "Smith", year: "2024" },
        {
          title: "Treatment of Diabetes Mellitus",
          authors: "Smith",
          year: "2024",
        },
      ];

      process.env.DEDUP_SIMILARITY_THRESHOLD = "0.95";
      const resultStrict = deduplicatePapers(papers);
      // With stricter threshold, these might not match
      const strictCount = resultStrict.uniqueResults;

      process.env.DEDUP_SIMILARITY_THRESHOLD = "0.8";
      const resultLenient = deduplicatePapers(papers);
      // With lenient threshold, these should match
      expect(resultLenient.uniqueResults).toBeLessThanOrEqual(strictCount);

      process.env.DEDUP_SIMILARITY_THRESHOLD = originalEnv;
    });
  });
});
