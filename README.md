# 🩺 Medical MCP Server

> **Bring trusted medical data directly into your AI workflow.** A local server for private, free access to FDA, WHO, PubMed, RxNorm, Semantic Scholar, and Google Scholar. No API keys. No data leaks.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that brings authoritative medical information into AI coding environments like Cursor and Claude Desktop.

<a href="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp/badge" alt="medical-mcp MCP server" />
</a>

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/medical-mcp)](https://archestra.ai/mcp-catalog/jamesanz__medical-mcp)

## Why Use Medical MCP?

- 🔒 **Your Data Never Leaves** – Runs 100% locally; no tracking, no logs, no cloud
- 🆓 **No API Keys** – Works out of the box, zero configuration
- 🏥 **Authoritative Sources** – FDA, TGA, Health Canada, EMA, DailyMed, WHO, PubMed, Europe PMC, RxNorm, ClinicalTrials.gov
- ⚡ **Easy Setup** – One-click install in [Cursor](https://cursor.sh) or simple manual setup
- 🔬 **Comprehensive** – Drug info, health stats, medical literature, clinical guidelines, pediatric sources
- 🛡️ **Resilient** – Circuit breakers, retry with backoff, rate limiting, and automatic fallbacks
- 📊 **Evidence-Graded** – Results tagged with study type and evidence level (Meta-Analysis → Case Report)
- 🏥 **Health Monitoring** – Built-in health check tool to diagnose source availability

## What's New in v2.0

- **Resilience Layer** – Circuit breakers per source, retry with exponential backoff + jitter, per-source token bucket rate limiters
- **Monid web search** – Scholar, Cochrane, AAP, and PMC HTML go through Monid TinyFish (Tavily-style search/fetch). Semantic Scholar is the no-key fallback
- **Evidence Grading** – PubMed and multi-database results tagged with study type (Systematic Review, RCT, Cohort, Case Report, etc.) and evidence grade (I–V)
- **Response Validation** – Zod schemas validate all upstream API responses, logging warnings on schema drift without breaking
- **NCBI API Key Support** – Optional `NCBI_API_KEY` env var boosts PubMed from 3 req/sec to 10 req/sec
- **Health Check Tool** – `health-check` pings all upstream sources and reports latency, circuit breaker states, rate limiter status, and cache health
- **Structured Logging** – Leveled, structured logging (DEBUG/INFO/WARN/ERROR) with source tracking and timing for every API call
- **Request Timeouts** – All upstream calls have explicit response/deadline timeouts to prevent hanging

## Quick Start

**Install in Cursor (Recommended):**

[🔗 Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=medical-mcp&config=eyJtZWRpY2FsLW1jcCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1lZGljYWwtbWNwIl19fQ==)

**Or install manually:**

```bash
npm install -g medical-mcp
# Or from source:
git clone https://github.com/JamesANZ/medical-mcp.git
cd medical-mcp && npm install && npm run build
```

## Features

### 💊 Drug Information

- **`search-drugs`** – Search FDA, DailyMed, TGA (Australia), Health Canada, and EMA. Filter with `countries` (`US`, `AU`, `CA`, `EU`)
- **`get-drug-details`** – Get comprehensive US drug info by NDC code
- **`search-drug-nomenclature`** – Standardized drug names via RxNorm
- **`search-drug-safety`** – FDA FAERS adverse events, recalls, and shortages

### 📊 Health Statistics

- **`get-health-statistics`** – WHO Global Health Observatory data (life expectancy, mortality, disease prevalence)

### 🔬 Medical Literature

- **`search-medical-literature`** – Search 30M+ PubMed articles (with evidence grading)
- **`get-article-details`** – Detailed article info by PMID
- **`search-google-scholar`** – Academic papers via Monid TinyFish (`research_paper`) when `MONID_API_KEY` is set; otherwise Semantic Scholar
- **`search-medical-databases`** – Multi-database search (PubMed, Scholar, Semantic Scholar, Cochrane, ClinicalTrials.gov, Europe PMC)
- **`search-medical-journals`** – Top journals (NEJM, JAMA, Lancet, BMJ, Nature Medicine)

### 🏥 Clinical Tools

- **`search-clinical-guidelines`** – Practice recommendations from medical organizations
- **`search-clinical-trials`** – ClinicalTrials.gov plus Australia/New Zealand location coverage
- **`list-sources`** – Full catalog of registry adapters and dedicated-tool sources (WHO, PubMed, RxNorm, Scholar, Cochrane, AAP), including which MCP tool reaches each. This is not the `search-drugs` five-regulator fanout.

### 👶 Pediatric Sources

- **`search-pediatric-guidelines`** – AAP guidelines and Bright Futures preventive care
- **`search-pediatric-literature`** – Research from major pediatric journals
- **`get-child-health-statistics`** – Pediatric health indicators from WHO
- **`search-pediatric-drugs`** – Drugs with pediatric labeling and dosing information
- **`search-aap-guidelines`** – Comprehensive AAP guideline search (Bright Futures + Policy Statements)

### 🛡️ Reliability & Monitoring

- **`health-check`** – Ping all upstream sources, report latency/status, circuit breaker states, and cache health
- **`get-cache-stats`** – View cache statistics (hit rate, memory usage, entry count)

## Installation

### Cursor (One-Click)

Click the install link above or use:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=medical-mcp&config=eyJtZWRpY2FsLW1jcCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1lZGljYWwtbWNwIl19fQ==
```

### Manual Installation

**Requirements:** Node.js 18+ and npm

```bash
git clone https://github.com/JamesANZ/medical-mcp.git
cd medical-mcp
npm install
npm run build
npm start
```

### Claude Desktop

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/medical-mcp/build/index.js"],
      "env": {
        "NCBI_API_KEY": "your_optional_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after configuration.

## Usage Examples

### Search for Drug Information

```json
{
  "tool": "search-drugs",
  "arguments": { "query": "Tylenol", "limit": 5 }
}
```

### Search Medical Literature (with Evidence Grading)

Results now include evidence tags:

```
1. Efficacy of COVID-19 Treatments: A Meta-Analysis
   Evidence: [Systematic Review / Meta-Analysis • Grade I]
   Authors: Smith J, Jones K...

2. Randomized Trial of Remdesivir in Adults
   Evidence: [Randomized Controlled Trial • Grade II]
   Authors: Chen L, Wang M...
```

### Run Health Check

```json
{ "tool": "health-check", "arguments": {} }
```

Returns:

```
✅ FDA: healthy (234ms)
✅ PubMed: healthy (156ms)
✅ WHO: healthy (890ms)
✅ RxNorm: healthy (312ms)
✅ ClinicalTrials: healthy (445ms)
✅ SemanticScholar: healthy (189ms)

NCBI API Key: ✅ Configured (10 req/sec PubMed)
```

## Architecture

### Resilience Stack

Every API call flows through a three-layer resilience stack:

```
Request → Rate Limiter → Circuit Breaker → Retry (with backoff) → Upstream API
```

- **Rate Limiter** — Per-source token bucket prevents exceeding API limits (PubMed: 3/sec without key, 10/sec with; FDA: 4/sec; Google Scholar: 0.2/sec)
- **Circuit Breaker** — After 3 consecutive failures, the circuit opens for 60s, preventing cascade failures. Transitions: CLOSED → OPEN → HALF_OPEN → CLOSED
- **Retry** — Exponential backoff with full jitter on transient failures (429, 5xx, network errors). Max 2 retries

### Evidence Grading

PubMed and multi-database results are automatically classified:

| Grade | Study Type                        | Examples                                      |
| ----- | --------------------------------- | --------------------------------------------- |
| I     | Systematic Review / Meta-Analysis | Cochrane reviews, PRISMA studies              |
| II    | Randomized Controlled Trial       | Double-blind placebo-controlled trials        |
| III   | Cohort / Case-Control Study       | Prospective, retrospective, population-based  |
| IV    | Case Report / Case Series         | Clinical case presentations                   |
| V     | Expert Opinion / Editorial        | Commentaries, perspectives, narrative reviews |

### Automatic Fallback

When `MONID_API_KEY` is set, Scholar/Cochrane/AAP search and PMC HTML fetch go through **Monid TinyFish**. Without a key, Scholar falls back to **Semantic Scholar's API** — free, well-structured, 100 req/sec, no API key needed.

### Response Validation

All upstream API responses are validated against Zod schemas. If a source changes their API response format, the server logs a warning but continues operating with raw data — no crashes, just alerts.

## Data Sources

| Source                              | Coverage                                 | Update Frequency | Resilience                         |
| ----------------------------------- | ---------------------------------------- | ---------------- | ---------------------------------- |
| **FDA**                             | US approved drug labels                  | Real-time        | Circuit breaker + retry            |
| **DailyMed**                        | US structured product labels             | Daily            | Circuit breaker + retry            |
| **TGA ARTG**                        | Australian Register of Therapeutic Goods | Real-time        | Circuit breaker + retry            |
| **Health Canada DPD**               | Canadian marketed/approved drugs         | Real-time        | Circuit breaker + retry            |
| **EMA**                             | EU centrally authorised medicines        | Twice daily JSON | In-memory cache + retry            |
| **FDA FAERS / recalls / shortages** | US safety signals                        | Real-time        | Circuit breaker + retry            |
| **WHO**                             | Global health stats (194 countries)      | Annual           | Circuit breaker + retry            |
| **PubMed**                          | 30M+ medical citations                   | Daily            | Circuit breaker + retry + NCBI key |
| **Europe PMC**                      | PubMed + preprints + patents             | Real-time        | Circuit breaker + retry            |
| **RxNorm**                          | Standardized drug nomenclature (US)      | Weekly           | Circuit breaker + retry            |
| **TinyFish via Monid**              | Research papers + domain-scoped web      | Real-time        | Optional `MONID_API_KEY`           |
| **Semantic Scholar**                | 200M+ papers with citation data          | Real-time        | Circuit breaker + retry            |
| **AAP**                             | Bright Futures & policy statements       | Periodic         | Graceful degradation               |
| **Pediatric Journals**              | Major pediatric journals                 | Daily            | Circuit breaker + retry            |
| **ClinicalTrials.gov**              | Global + AU/NZ location filter           | Real-time        | Circuit breaker + retry            |
| **Cochrane**                        | Systematic reviews                       | Real-time        | Monid TinyFish search              |

## Configuration

### Environment Variables

**Performance & Reliability:**

| Variable           | Default  | Description                                                                                                                                                                    |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NCBI_API_KEY`     | _(none)_ | Free PubMed API key — 3x throughput. Get one at [NCBI](https://www.ncbi.nlm.nih.gov/account/settings/)                                                                         |
| `MONID_API_KEY`    | _(none)_ | Optional. When set, Scholar/Cochrane/AAP/PMC HTML use Monid's TinyFish search and fetch (Tavily-style web scraper). Get a key at [Monid](https://app.monid.ai/access/api-keys) |
| `TINYFISH_API_KEY` | _(none)_ | Optional fallback if you call TinyFish directly instead of through Monid.                                                                                                      |
| `LOG_LEVEL`        | `INFO`   | Logging level: `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT`                                                                                                                      |

**Cache:**

| Variable                   | Default   | Description                   |
| -------------------------- | --------- | ----------------------------- |
| `CACHE_ENABLED`            | `true`    | Enable/disable caching        |
| `CACHE_MAX_SIZE`           | `1000`    | Maximum cache entries         |
| `CACHE_TTL_FDA`            | `86400`   | FDA TTL in seconds (24h)      |
| `CACHE_TTL_PUBMED`         | `3600`    | PubMed TTL (1h)               |
| `CACHE_TTL_WHO`            | `604800`  | WHO TTL (7d)                  |
| `CACHE_TTL_RXNORM`         | `2592000` | RxNorm TTL (30d)              |
| `CACHE_TTL_GOOGLE_SCHOLAR` | `3600`    | Google Scholar TTL (1h)       |
| `CACHE_TTL_BRIGHT_FUTURES` | `2592000` | Bright Futures TTL (30d)      |
| `CACHE_TTL_AAP_POLICY`     | `604800`  | AAP Policy TTL (7d)           |
| `CACHE_TTL_REGULATORS`     | `86400`   | TGA/EMA/Health Canada TTL     |
| `CACHE_TTL_SAFETY`         | `3600`    | FAERS/recalls/shortages TTL   |
| `CACHE_TTL_TRIALS`         | `3600`    | Clinical trial search TTL     |
| `CACHE_CLEANUP_INTERVAL`   | `300000`  | Cleanup interval in ms (5min) |

**Deduplication:**

| Variable                     | Default | Description                               |
| ---------------------------- | ------- | ----------------------------------------- |
| `DEDUP_ENABLED`              | `true`  | Enable/disable cross-source deduplication |
| `DEDUP_SIMILARITY_THRESHOLD` | `0.9`   | Fuzzy title match threshold (0.0–1.0)     |
| `DEDUP_LOG_REMOVED`          | `false` | Log removed duplicates                    |

**Performance**: Cached responses return in <10ms vs 800–1500ms for API calls. Expected hit rate: 60%+ for common queries.

## Security & Privacy

- ✅ **Localhost-only** – Server runs locally, no external access
- ✅ **No data storage** – All queries are real-time, nothing saved to disk
- ✅ **Process isolation** – Medical data stays on your machine
- ✅ **No API keys required** – Works without credentials (NCBI and Monid keys are optional)

## Technical Details

**Built with:** Node.js, TypeScript, MCP SDK
**Dependencies:** `@modelcontextprotocol/sdk`, `superagent`, `zod`, `express`, `cors`
**Platforms:** macOS, Windows, Linux

**Source layout:**

```
src/
├── index.ts                    # MCP tool definitions
├── utils.ts                    # Core API functions + formatters
├── constants.ts                # API URLs, config constants
├── types.ts                    # TypeScript types
├── logger.ts                   # Structured leveled logging
├── cache/
│   ├── config.ts               # TTL policies, env var support
│   └── manager.ts              # In-memory LRU cache
├── resilience/
│   ├── index.ts                # Composed resilientCall()
│   ├── circuit-breaker.ts      # Per-source circuit breaker
│   ├── retry.ts                # Exponential backoff + jitter
│   └── rate-limiter.ts         # Token bucket rate limiter
├── validation/
│   └── schemas.ts              # Zod schemas for API responses
├── sources/                    # Country/source registry + adapters
│   ├── adapters/               # FDA, TGA, Health Canada, EMA, DailyMed, FAERS, trials, TinyFish
│   └── ...
└── utils/
    ├── deduplication.ts         # Cross-source paper dedup
    ├── evidence-grading.ts      # Study type classification
    └── semantic-scholar.ts      # Semantic Scholar API client
```

## Medical Disclaimer

⚠️ **Important**: This tool provides information from authoritative sources but should **not** replace professional medical advice, diagnosis, or treatment. Always consult qualified healthcare professionals for medical decisions.

## Contributing

⭐ **If this project helps you, please star it on GitHub!** ⭐

Contributions welcome! Please open an issue or submit a pull request.

## License

MIT License – see [LICENSE.md](LICENSE.md) for details.

## Support

If you find this project useful, consider supporting it:

**⚡ Lightning Network**

```
lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa
```

**₿ Bitcoin**: [bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)

**Ξ Ethereum/EVM**: [0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)
