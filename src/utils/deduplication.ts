import { GoogleScholarArticle, PubMedArticle } from "../types.js";

/**
 * Paper-like type that can represent articles from different sources
 */
export type PaperLike =
  | GoogleScholarArticle
  | PubMedArticle
  | {
      title: string;
      authors?: string | string[];
      year?: string;
      doi?: string;
      [key: string]: any;
    };

/**
 * Fingerprint for duplicate detection
 */
export type Fingerprint = {
  doi?: string;
  normalizedTitle: string;
  firstAuthor?: string;
  year?: string;
};

/**
 * Result of deduplication process
 */
export type DeduplicationResult = {
  papers: PaperLike[];
  totalResults: number;
  uniqueResults: number;
  duplicatesRemoved: number;
};

/**
 * Normalize title for comparison
 * - Convert to lowercase
 * - Remove punctuation (-, :, ., ,, ;)
 * - Remove extra whitespace
 * - Trim
 * - Remove version indicators (Version 1, Preprint, arXiv:...)
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";

  // Decode HTML entities (Node.js environment)
  let decoded = title
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );

  // Remove version indicators
  decoded = decoded
    .replace(/\b(version\s+\d+|v\d+)\b/gi, "")
    .replace(/\b(preprint|published version|final version)\b/gi, "")
    .replace(/\barxiv:\d{4}\.\d+\b/gi, "")
    .replace(/\b\[preprint\]\b/gi, "")
    .replace(/\b\[published\]\b/gi, "");

  // Normalize: lowercase, remove punctuation, normalize whitespace
  return decoded
    .toLowerCase()
    .replace(/[-:.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score between 0.0 and 1.0
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;

  // Create matrix for Levenshtein distance
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1.0 - distance / maxLen;
}

/**
 * Extract first author's last name from authors string or array
 */
export function extractFirstAuthor(
  authors: string | string[] | undefined,
): string | undefined {
  if (!authors) return undefined;

  let authorStr: string;
  if (Array.isArray(authors)) {
    if (authors.length === 0) return undefined;
    authorStr = authors[0];
  } else {
    authorStr = authors;
  }

  // Extract first author's last name
  // Common formats: "Smith, J." or "Smith J" or "J. Smith" or "Smith et al."
  const trimmed = authorStr.trim();

  // Handle "et al." or "et al"
  const etAlMatch = trimmed.match(/^([^,]+)/);
  if (etAlMatch) {
    const firstPart = etAlMatch[1].trim();
    // If it's "Smith et al", return "Smith"
    if (firstPart.toLowerCase().includes("et al")) {
      const beforeEtAl = firstPart.split(/et\s+al/i)[0].trim();
      return beforeEtAl.split(/\s+/).pop()?.toLowerCase();
    }
  }

  // Try "Last, First" format
  const commaMatch = trimmed.match(/^([^,]+),/);
  if (commaMatch) {
    return commaMatch[1].trim().split(/\s+/).pop()?.toLowerCase();
  }

  // Try "First Last" format - take last word
  const words = trimmed.split(/\s+/);
  if (words.length > 0) {
    // Skip if first word looks like an initial (single letter or letter + period)
    if (words.length > 1 && /^[A-Z]\.?$/.test(words[0])) {
      return words[1]?.toLowerCase();
    }
    return words[words.length - 1]?.toLowerCase();
  }

  return undefined;
}

/**
 * Extract year from various date formats
 */
export function extractYear(
  dateOrYear: string | undefined,
): string | undefined {
  if (!dateOrYear) return undefined;

  // Try to extract 4-digit year
  const yearMatch = dateOrYear.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = yearMatch[0];
    const yearNum = parseInt(year, 10);
    // Validate year is reasonable (1900 to current year + 1)
    if (yearNum >= 1900 && yearNum <= new Date().getFullYear() + 1) {
      return year;
    }
  }

  return undefined;
}

/**
 * Get year from a paper (handles both GoogleScholarArticle and PubMedArticle)
 */
function getPaperYear(paper: PaperLike): string | undefined {
  if ("year" in paper && paper.year) {
    return paper.year;
  }
  if ("publication_date" in paper && paper.publication_date) {
    return extractYear(paper.publication_date);
  }
  return undefined;
}

/**
 * Create fingerprint for a paper
 */
export function createFingerprint(paper: PaperLike): Fingerprint {
  const normalizedTitle = normalizeTitle(paper.title || "");
  const firstAuthor = extractFirstAuthor(paper.authors);
  const year = getPaperYear(paper);

  return {
    doi: paper.doi,
    normalizedTitle,
    firstAuthor,
    year,
  };
}

/**
 * Check if two papers are duplicates
 * Returns true if they match by:
 * 1. DOI (if both have DOIs)
 * 2. Exact match (normalized title + author + year)
 * 3. Fuzzy match (90%+ title similarity + same author + year)
 */
export function areDuplicates(
  paper1: PaperLike,
  paper2: PaperLike,
  similarityThreshold: number = 0.9,
): boolean {
  const fp1 = createFingerprint(paper1);
  const fp2 = createFingerprint(paper2);

  // 1. DOI match - definitely same paper
  if (fp1.doi && fp2.doi && fp1.doi === fp2.doi) {
    return true;
  }

  // 2. Exact match - same normalized title + author + year
  if (
    fp1.normalizedTitle === fp2.normalizedTitle &&
    fp1.normalizedTitle.length > 0
  ) {
    // If titles match exactly, check author and year
    if (fp1.firstAuthor && fp2.firstAuthor) {
      if (fp1.firstAuthor === fp2.firstAuthor) {
        // If both have year, they must match
        if (fp1.year && fp2.year) {
          return fp1.year === fp2.year;
        }
        // If only one has year, still consider it a match (year might be missing)
        return true;
      }
    } else if (!fp1.firstAuthor && !fp2.firstAuthor) {
      // Neither has author, match by title + year
      if (fp1.year && fp2.year) {
        return fp1.year === fp2.year;
      }
      // No author, no year - match by title only
      return true;
    }
    // One has author, one doesn't - be more strict
    if (fp1.year && fp2.year) {
      return fp1.year === fp2.year;
    }
  }

  // 3. Fuzzy match - 90%+ title similarity + same author + year
  const similarity = calculateSimilarity(
    fp1.normalizedTitle,
    fp2.normalizedTitle,
  );

  if (similarity >= similarityThreshold) {
    // Titles are similar, check author and year
    if (fp1.firstAuthor && fp2.firstAuthor) {
      if (fp1.firstAuthor === fp2.firstAuthor) {
        // If both have year, they must match
        if (fp1.year && fp2.year) {
          return fp1.year === fp2.year;
        }
        // Similar title + same author = likely duplicate
        return true;
      }
    } else if (!fp1.firstAuthor && !fp2.firstAuthor) {
      // Neither has author, match by title similarity + year
      if (fp1.year && fp2.year) {
        return fp1.year === fp2.year;
      }
      // Very high similarity without author/year = likely duplicate
      return similarity >= 0.95;
    }
  }

  return false;
}

/**
 * Deduplicate papers array
 * Returns unique papers and statistics
 */
export function deduplicatePapers(papers: PaperLike[]): DeduplicationResult {
  const enabled =
    process.env.DEDUP_ENABLED !== "false" && process.env.DEDUP_ENABLED !== "0";
  const similarityThreshold = parseFloat(
    process.env.DEDUP_SIMILARITY_THRESHOLD || "0.9",
  );
  const logRemoved = process.env.DEDUP_LOG_REMOVED === "true";

  if (!enabled || papers.length === 0) {
    return {
      papers,
      totalResults: papers.length,
      uniqueResults: papers.length,
      duplicatesRemoved: 0,
    };
  }

  const unique: PaperLike[] = [];
  const seenFingerprints = new Map<string, number>(); // Track which index we've seen

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    let isDuplicate = false;
    let duplicateReason = "";

    // Check against all previously seen papers
    for (let j = 0; j < unique.length; j++) {
      if (areDuplicates(paper, unique[j], similarityThreshold)) {
        isDuplicate = true;

        // Determine reason for logging
        const fp1 = createFingerprint(paper);
        const fp2 = createFingerprint(unique[j]);
        if (fp1.doi && fp2.doi && fp1.doi === fp2.doi) {
          duplicateReason = "DOI match";
        } else if (
          fp1.normalizedTitle === fp2.normalizedTitle &&
          fp1.normalizedTitle.length > 0
        ) {
          duplicateReason = "Exact title match";
        } else {
          duplicateReason = "Fuzzy title match";
        }

        // Keep the version with more complete metadata
        const currentHasDOI = !!paper.doi;
        const existingHasDOI = !!unique[j].doi;
        const currentMetadata = [
          paper.title,
          paper.authors,
          getPaperYear(paper),
          paper.abstract,
        ].filter(Boolean).length;
        const existingMetadata = [
          unique[j].title,
          unique[j].authors,
          getPaperYear(unique[j]),
          unique[j].abstract,
        ].filter(Boolean).length;

        // Replace if current has DOI and existing doesn't, or has more metadata
        if (
          (currentHasDOI && !existingHasDOI) ||
          (!currentHasDOI &&
            !existingHasDOI &&
            currentMetadata > existingMetadata)
        ) {
          unique[j] = paper;
        }

        break;
      }
    }

    if (!isDuplicate) {
      unique.push(paper);
    } else if (logRemoved) {
      console.log(
        `[DEDUP] Removed duplicate: "${paper.title}" - ${duplicateReason}`,
      );
    }
  }

  return {
    papers: unique,
    totalResults: papers.length,
    uniqueResults: unique.length,
    duplicatesRemoved: papers.length - unique.length,
  };
}
