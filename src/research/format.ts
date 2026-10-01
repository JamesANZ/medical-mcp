import type { ResearchHit, ResearchReport, ResearchSection } from "./types.js";

const SECTIONS: { id: ResearchSection; title: string }[] = [
  { id: "label", title: "Label and regulatory notices" },
  { id: "surveillance", title: "Spontaneous reports" },
  { id: "studies", title: "Studies" },
  { id: "trials", title: "Trials" },
  { id: "web", title: "Web" },
  { id: "discussion", title: "Patient and public discussion" },
];

function sectionRequested(report: ResearchReport, section: ResearchSection): boolean {
  const sources = new Set(report.sources);
  if (section === "label" || section === "surveillance") return sources.has("authoritative");
  if (section === "studies" || section === "trials") return sources.has("scientific");
  if (section === "web") return sources.has("web");
  return sources.has("reddit") || sources.has("youtube") || sources.has("x");
}

function quoteExcerpt(excerpt: string): string {
  if (!excerpt) return "   > (no text)";
  return excerpt
    .split("\n")
    .map((line) => `   > ${line}`)
    .join("\n");
}

function formatHit(hit: ResearchHit, index: number): string {
  let text = `${index}. **${hit.title}**\n`;
  text += `   Source: ${hit.source}\n`;
  text += `   Source class: ${hit.sourceClass}\n`;
  text += `   Claim role: ${hit.claimRole}\n`;
  if (hit.evidenceTag) text += `   Evidence: ${hit.evidenceTag}\n`;
  text += `   Date: ${hit.publishedAt || "unknown"}\n`;
  if (hit.url) text += `   URL: ${hit.url}\n`;
  if (hit.identifiers) {
    for (const identifier of hit.identifiers) {
      text += `   ${identifier.type}: ${identifier.value}\n`;
    }
  }
  text += `   Query-term overlap: ${hit.lexicalOverlap}\n`;
  text += `   Framing: ${hit.framing}\n`;
  text += `${quoteExcerpt(hit.excerpt)}\n`;
  return text;
}

function emptySection(report: ResearchReport, section: ResearchSection): string {
  if (section === "label" && report.drugTerms.length === 0) {
    return "No drug name was identified in the query, so no label excerpt was retrieved. This is not evidence of absence.\n";
  }
  return "None returned. This is not evidence of absence.\n";
}

export function formatResearchReport(report: ResearchReport) {
  let text = `**Medical research for "${report.query}"**\n\n`;
  text +=
    "Retrieved records are labeled by source class. Anecdotes and unclassified web pages are not clinical evidence. Sections are not reconciled. An empty section is not evidence of absence.\n";
  text += `Lookback: ${report.lookback}. Query-term overlap is a retrieval hint, not clinical confidence.\n`;

  for (const section of SECTIONS) {
    if (!sectionRequested(report, section.id)) continue;
    const hits = report.hits.filter((hit) => hit.section === section.id);
    text += `\n## ${section.title}\n\n`;
    if (hits.length === 0) {
      text += emptySection(report, section.id);
      continue;
    }
    hits.forEach((hit, index) => {
      text += formatHit(hit, index + 1);
      text += "\n";
    });
  }

  if (report.warnings.length > 0) {
    text += `\n## Warnings\n\n`;
    for (const warning of report.warnings) {
      const source = warning.source ? `${warning.source}: ` : "";
      text += `- ${source}${warning.code} — ${warning.message}\n`;
    }
  }

  text +=
    "\nResearch retrieval only. This is not medical advice. Social and unclassified web text are not clinical evidence. Missing records are not evidence of absence.\n";

  return {
    content: [{ type: "text" as const, text }],
  };
}
