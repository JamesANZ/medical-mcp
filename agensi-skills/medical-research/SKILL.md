---
name: medical-research
description: Looks up drug labels, adverse events, trials, guidelines, and medical literature through the connected medical MCP server. Use when the user asks for an FDA label, a trial, a PubMed paper, a guideline, pediatric labeling, or a WHO statistic. This is source lookup, not diagnosis or treatment.
---

# Medical source lookup

The medical MCP server must already be connected. If `list-sources` is missing, stop and give the user the install block in README.md. Do not invent citations, doses, or diagnoses.

This skill provides information from the connected sources. It does not replace professional medical advice, diagnosis, or treatment.

## Workflow

1. Call `list-sources` when the user asks which databases are available, or when you are unsure which tool covers a source.
2. Pick one tool:
   - Drug label or regulator record: `search-drugs`. Narrow with `countries` (`US`, `AU`, `CA`, `EU`) when they name a country.
   - Standardized name: `search-drug-nomenclature`.
   - Adverse events, recalls, or shortages: `search-drug-safety`.
   - Trials: `search-clinical-trials`.
   - Practice recommendations: `search-clinical-guidelines`.
   - Papers: `search-medical-literature`, then `get-article-details` with a PMID from those hits.
   - NEJM, JAMA, Lancet, BMJ, or Nature Medicine: `search-medical-journals`.
   - Pediatric labeling: `search-pediatric-drugs`. Pediatric papers: `search-pediatric-literature`. AAP or Bright Futures: `search-pediatric-guidelines`.
   - WHO indicator: `get-health-statistics`.
3. Read [references/tools.md](references/tools.md) for arguments. Pass `question` or `rerank` on literature tools only when the user asked which papers answer a specific question.

## Output

- Source name and the tool
- Title, identifier (PMID, NDC, NCT id), and link the tool returned
- A one-line note that this is source text, not a diagnosis or a dose recommendation

## Boundaries

Do not diagnose, prescribe, or recommend a dose. Do not call `health-check`, `get-cache-stats`, `search-google-scholar`, `rank-search-hits`, or `research-medical-topic` from this skill.
