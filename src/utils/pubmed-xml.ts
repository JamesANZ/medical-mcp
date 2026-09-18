import type { PubMedArticle } from "../types.js";
import { decodeHtmlEntities } from "./text.js";

function firstMatch(xml: string, pattern: RegExp): string | undefined {
  const match = xml.match(pattern);
  return match?.[1]?.trim();
}

function innerTag(xml: string, tag: string): string | undefined {
  return firstMatch(xml, new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
}

function stripTags(xml: string): string {
  return decodeHtmlEntities(xml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

/**
 * PMC IDs must come from PubmedData > ArticleIdList for THIS article.
 * ReferenceList also contains ArticleId[@IdType="pmc"] for cited papers;
 * matching anywhere in the XML attaches the wrong full text.
 */
export function extractArticlePmcId(articleXml: string): string | undefined {
  const pubmedData = innerTag(articleXml, "PubmedData");
  if (!pubmedData) return undefined;
  const ownIds = pubmedData.split(/<ReferenceList[\s>]/i)[0];
  const idList = innerTag(ownIds, "ArticleIdList");
  if (!idList) return undefined;
  const pmcMatch = idList.match(
    /<ArticleId[^>]*IdType="pmc"[^>]*>(?:PMC)?(\d+)<\/ArticleId>/i,
  );
  return pmcMatch?.[1]?.trim();
}

export function extractPmcRecordIds(pmcXml: string): {
  pmid?: string;
  doi?: string;
} {
  const pmid = firstMatch(
    pmcXml,
    /<article-id[^>]*pub-id-type="pmid"[^>]*>(\d+)<\/article-id>/i,
  );
  const doi = firstMatch(
    pmcXml,
    /<article-id[^>]*pub-id-type="doi"[^>]*>([^<]+)<\/article-id>/i,
  );
  return { pmid, doi: doi ? doi.trim().toLowerCase() : undefined };
}

export function pmcRecordMatchesArticle(
  pmcXml: string,
  expected: { pmid?: string; doi?: string },
): boolean {
  const ids = extractPmcRecordIds(pmcXml);
  if (expected.pmid && ids.pmid) {
    return ids.pmid === expected.pmid.trim();
  }
  if (expected.doi && ids.doi) {
    const want = expected.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase();
    return ids.doi === want;
  }
  // No identifiers in the PMC record to verify — do not attach full text.
  return false;
}

export function parsePubMedXML(xmlText: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  const articleMatches = xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g);
  if (!articleMatches) return articles;

  for (const articleXml of articleMatches) {
    try {
      const citation =
        articleXml.match(/<MedlineCitation[\s\S]*?<\/MedlineCitation>/)?.[0] ||
        articleXml;

      const pmid = firstMatch(citation, /<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmid) continue;

      const titleXml = innerTag(citation, "ArticleTitle") || "";
      const title = stripTags(titleXml) || "No title available";

      let abstract = "No abstract available";
      const abstractBlocks = citation.match(
        /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g,
      );
      if (abstractBlocks && abstractBlocks.length > 0) {
        abstract = abstractBlocks
          .map((block) => stripTags(block))
          .filter(Boolean)
          .join(" ");
      }

      const authors: string[] = [];
      const authorList = innerTag(citation, "AuthorList") || "";
      const authorMatches = authorList.match(/<Author[\s\S]*?<\/Author>/g);
      if (authorMatches) {
        for (const authorXml of authorMatches) {
          const collective = innerTag(authorXml, "CollectiveName");
          const lastName = innerTag(authorXml, "LastName");
          const firstName = innerTag(authorXml, "ForeName");
          if (collective) {
            authors.push(decodeHtmlEntities(collective));
          } else if (lastName && firstName) {
            authors.push(
              `${decodeHtmlEntities(firstName)} ${decodeHtmlEntities(lastName)}`,
            );
          } else if (lastName) {
            authors.push(decodeHtmlEntities(lastName));
          }
        }
      }

      const journalXml = innerTag(citation, "Journal") || "";
      const journalTitle =
        innerTag(journalXml, "Title") ||
        innerTag(journalXml, "ISOAbbreviation") ||
        "Journal information not available";
      const journal = decodeHtmlEntities(journalTitle);

      const pubDate = innerTag(citation, "PubDate") || "";
      const year = innerTag(pubDate, "Year");
      const monthRaw = innerTag(pubDate, "Month");
      const dayRaw = innerTag(pubDate, "Day");
      let publicationDate = "Date not available";
      if (year) {
        const monthNum = monthRaw
          ? /^\d+$/.test(monthRaw)
            ? monthRaw.padStart(2, "0")
            : monthToNumber(monthRaw)
          : "01";
        const day = dayRaw?.padStart(2, "0") || "01";
        publicationDate = `${year}-${monthNum}-${day}`;
      }

      const doi =
        firstMatch(
          citation,
          /<ELocationID[^>]*EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/i,
        ) ||
        firstMatch(
          articleXml.match(/<PubmedData>[\s\S]*?<\/PubmedData>/)?.[0] || "",
          /<ArticleId[^>]*IdType="doi"[^>]*>([^<]+)<\/ArticleId>/i,
        );

      articles.push({
        pmid,
        title,
        abstract,
        authors,
        journal,
        publication_date: publicationDate,
        doi: doi ? decodeHtmlEntities(doi.trim()) : undefined,
        pmc_id: extractArticlePmcId(articleXml),
      });
    } catch (error) {
      console.error("Error parsing individual article:", error);
    }
  }

  return articles;
}

function monthToNumber(month: string): string {
  const map: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  return map[month.slice(0, 3).toLowerCase()] || "01";
}
