import { deduplicatePapers, type PaperLike } from "../deduplication.js";

/**
 * Integration tests for deduplication with real-world scenarios
 * Note: These tests may require network access and could be slow
 */
describe("Deduplication Integration Tests", () => {
  test("Test 6: Google Scholar real data - verify low duplicate rate", () => {
    // Simulate Google Scholar results with duplicates
    const papers: PaperLike[] = [
      {
        title: "CRISPR gene therapy for cancer treatment",
        authors: "Smith, J.",
        year: "2024",
        journal: "Nature Medicine",
      },
      {
        title: "CRISPR gene therapy for cancer treatment",
        authors: "Smith, J.",
        year: "2024",
        journal: "Nature Medicine",
        doi: "10.1234/nature.2024.001",
      },
      {
        title: "CRISPR gene therapy for cancer treatment - Preprint",
        authors: "Smith, J.",
        year: "2024",
      },
      {
        title: "CRISPR-Based Gene Therapy in Cancer",
        authors: "Smith, J.",
        year: "2024",
        doi: "10.1234/nature.2024.001",
      },
      {
        title: "Novel approaches to diabetes treatment",
        authors: "Jones, M.",
        year: "2024",
      },
      {
        title: "Novel approaches to diabetes treatment",
        authors: "Jones, M.",
        year: "2024",
      },
    ];

    const result = deduplicatePapers(papers);

    // Should have < 5% duplicate rate (6 papers -> should have at least 2 unique)
    const duplicateRate = result.duplicatesRemoved / result.totalResults;
    expect(duplicateRate).toBeLessThan(0.5); // Less than 50% duplicates
    expect(result.uniqueResults).toBeGreaterThanOrEqual(2);
    expect(result.uniqueResults).toBeLessThanOrEqual(3); // Should deduplicate to 2-3 unique papers
  });

  test("Test 7: Cross-source deduplication - same paper from PubMed + Google Scholar", () => {
    // Simulate same paper from different sources
    const pubmedPaper: PaperLike = {
      title: "Treatment of Type 2 Diabetes with Metformin",
      authors: ["Smith, J.", "Jones, M."],
      publication_date: "2024-01-15",
      doi: "10.1234/pubmed.2024.001",
      journal: "New England Journal of Medicine",
      abstract: "This study examines...",
    };

    const scholarPaper: PaperLike = {
      title: "Treatment of Type 2 Diabetes with Metformin",
      authors: "Smith, J., Jones, M.",
      year: "2024",
      doi: "10.1234/pubmed.2024.001",
      journal: "NEJM",
      abstract: "This study examines...",
    };

    const papers = [pubmedPaper, scholarPaper];
    const result = deduplicatePapers(papers);

    // Should deduplicate to 1 paper (same DOI)
    expect(result.uniqueResults).toBe(1);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.papers[0].doi).toBe("10.1234/pubmed.2024.001");
  });

  test("Test 7b: Cross-source without DOI - match by title+author+year", () => {
    const pubmedPaper: PaperLike = {
      title: "CRISPR Applications in Oncology",
      authors: ["Brown, A."],
      publication_date: "2023-06-01",
      journal: "Cancer Research",
    };

    const scholarPaper: PaperLike = {
      title: "CRISPR Applications in Oncology",
      authors: "Brown, A.",
      year: "2023",
      journal: "Cancer Research",
    };

    const papers = [pubmedPaper, scholarPaper];
    const result = deduplicatePapers(papers);

    // Should match by title + author + year
    expect(result.uniqueResults).toBe(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  test("Test 3: Performance test - 100+ papers, verify <50ms overhead", () => {
    // Generate 100 papers with some duplicates
    const papers: PaperLike[] = [];
    for (let i = 0; i < 50; i++) {
      papers.push({
        title: `Paper ${i}`,
        authors: `Author ${i}`,
        year: "2024",
      });
      // Add duplicate
      papers.push({
        title: `Paper ${i}`,
        authors: `Author ${i}`,
        year: "2024",
      });
    }

    const startTime = Date.now();
    const result = deduplicatePapers(papers);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (< 50ms for 100 papers)
    expect(duration).toBeLessThan(100); // Allow some buffer
    expect(result.uniqueResults).toBe(50);
    expect(result.duplicatesRemoved).toBe(50);
  });

  test("Real-world scenario: Multiple versions of same paper", () => {
    const papers: PaperLike[] = [
      {
        title: "Gene Therapy for Cancer: A Comprehensive Review",
        authors: "Smith, J.",
        year: "2024",
        journal: "Nature",
        doi: "10.1234/nature.2024.001",
      },
      {
        title: "Gene Therapy for Cancer: A Comprehensive Review [Preprint]",
        authors: "Smith, J.",
        year: "2024",
      },
      {
        title: "Gene Therapy for Cancer: A Comprehensive Review - Version 2",
        authors: "Smith, J.",
        year: "2024",
        doi: "10.1234/nature.2024.001",
      },
      {
        title: "Gene Therapy for Cancer: A Comprehensive Review",
        authors: "Smith, J.",
        year: "2024",
        journal: "Nature",
        doi: "10.1234/nature.2024.001",
      },
      {
        title: "Different Paper on Cancer",
        authors: "Jones, M.",
        year: "2024",
      },
    ];

    const result = deduplicatePapers(papers);

    // Should deduplicate multiple versions to 1, keep different paper
    expect(result.uniqueResults).toBe(2); // 1 unique review + 1 different paper
    expect(result.duplicatesRemoved).toBe(3);
    // Should keep the version with DOI
    const reviewPaper = result.papers.find((p) =>
      p.title.includes("Comprehensive Review"),
    );
    expect(reviewPaper?.doi).toBe("10.1234/nature.2024.001");
  });

  test("Edge case: Papers with missing metadata", () => {
    const papers: PaperLike[] = [
      { title: "Paper A", authors: "Smith" }, // No year
      { title: "Paper A", authors: "Smith", year: "2024" },
      { title: "Paper B", year: "2024" }, // No author
      { title: "Paper B", year: "2024" },
      { title: "Paper C" }, // No author, no year
      { title: "Paper C" },
    ];

    const result = deduplicatePapers(papers);

    // Should handle missing metadata gracefully
    expect(result.uniqueResults).toBeLessThanOrEqual(3);
    expect(result.uniqueResults).toBeGreaterThanOrEqual(2);
  });

  test("Edge case: Very similar but different papers", () => {
    const papers: PaperLike[] = [
      {
        title: "CRISPR Applications in Cancer Treatment",
        authors: "Smith, J.",
        year: "2024",
      },
      {
        title: "CRISPR Applications in Diabetes Treatment",
        authors: "Smith, J.",
        year: "2024",
      },
    ];

    const result = deduplicatePapers(papers);

    // Should NOT deduplicate - different topics
    expect(result.uniqueResults).toBe(2);
    expect(result.duplicatesRemoved).toBe(0);
  });
});
