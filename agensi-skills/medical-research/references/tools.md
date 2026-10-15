# Medical MCP tools this skill uses

| Tool | Use it for |
| --- | --- |
| `list-sources` | Which sources exist and which tool reaches each |
| `search-drugs` | FDA, DailyMed, TGA, Health Canada, and EMA. `query` required. Optional `countries`: `US`, `AU`, `CA`, `EU`. Optional `limit`. |
| `search-drug-nomenclature` | RxNorm names |
| `search-drug-safety` | FDA FAERS adverse events, recalls, and shortages |
| `search-clinical-trials` | ClinicalTrials.gov |
| `search-clinical-guidelines` | Practice recommendations |
| `search-medical-literature` | PubMed. Optional `question` or `rerank` reorders hits. |
| `get-article-details` | One article by PMID |
| `search-medical-journals` | NEJM, JAMA, Lancet, BMJ, Nature Medicine |
| `search-pediatric-drugs` | Pediatric labeling, NDC, manufacturer, DailyMed URL |
| `search-pediatric-literature` | Pediatric journal research. Optional `question` or `rerank`. |
| `search-pediatric-guidelines` | AAP policy and clinical reports, plus Bright Futures |
| `get-health-statistics` | WHO Global Health Observatory indicators |

Do not use `health-check`, `get-cache-stats`, `search-google-scholar`, `rank-search-hits`, or `research-medical-topic` with this skill.
