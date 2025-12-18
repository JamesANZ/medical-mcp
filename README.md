# 🩺 Medical MCP Server

> **Bring trusted medical data directly into your AI workflow.** A local server for private, free access to FDA, WHO, PubMed, RxNorm, and Google Scholar. No API keys. No data leaks.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that brings authoritative medical information into AI coding environments like Cursor and Claude Desktop.

<a href="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp/badge" alt="medical-mcp MCP server" />
</a>

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/medical-mcp)](https://archestra.ai/mcp-catalog/jamesanz__medical-mcp)

## Why Use Medical MCP?

- 🔒 **Your Data Never Leaves** – Runs 100% locally; no tracking, no logs, no cloud
- 🆓 **No API Keys** – Works out of the box, zero configuration
- 🏥 **Authoritative Sources** – FDA, WHO, PubMed, RxNorm, Google Scholar, AAP, pediatric journals
- ⚡ **Easy Setup** – One-click install in [Cursor](https://cursor.sh) or simple manual setup
- 🔬 **Comprehensive** – Drug info, health stats, medical literature, clinical guidelines, pediatric sources

## Quick Start

Ready to bring medical intelligence into your AI workflow? Install in seconds:

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

- **`search-drugs`** – Search FDA database by brand or generic name
- **`get-drug-details`** – Get comprehensive drug info by NDC code
- **`search-drug-nomenclature`** – Standardized drug names via RxNorm

### 📊 Health Statistics

- **`get-health-statistics`** – WHO Global Health Observatory data (life expectancy, mortality, disease prevalence)

### 🔬 Medical Literature

- **`search-medical-literature`** – Search 30M+ PubMed articles
- **`get-article-details`** – Detailed article info by PMID
- **`search-google-scholar`** – Academic research with citations
- **`search-medical-databases`** – Multi-database search (PubMed, Scholar, Cochrane, ClinicalTrials.gov)
- **`search-medical-journals`** – Top journals (NEJM, JAMA, Lancet, BMJ, Nature Medicine)

### 🏥 Clinical Tools

- **`search-clinical-guidelines`** – Practice recommendations from medical organizations

### 👶 Pediatric Sources

- **`search-pediatric-guidelines`** – AAP guidelines and Bright Futures preventive care
- **`search-pediatric-literature`** – Research from major pediatric journals (Pediatrics, JAMA Pediatrics, etc.)
- **`get-child-health-statistics`** – Pediatric health indicators from WHO (mortality, immunization, nutrition)
- **`search-pediatric-drugs`** – Drugs with pediatric labeling and dosing information
- **`search-aap-guidelines`** – Comprehensive AAP guideline search (Bright Futures + Policy Statements)

### 📊 Cache Management

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
# Clone and build
git clone https://github.com/JamesANZ/medical-mcp.git
cd medical-mcp
npm install
npm run build

# Run server
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
      "args": ["/absolute/path/to/medical-mcp/build/index.js"]
    }
  }
}
```

Restart Claude Desktop after configuration.

## Usage Examples

### Search for Drug Information

Ask about a medication's uses, dosage, and safety information:

```json
{
  "tool": "search-drugs",
  "arguments": { "query": "Tylenol", "limit": 5 }
}
```

### Get Health Statistics

Retrieve global health indicators like life expectancy or mortality rates:

```json
{
  "tool": "get-health-statistics",
  "arguments": {
    "indicator": "Life expectancy at birth (years)",
    "country": "USA"
  }
}
```

### Search Medical Literature

Find peer-reviewed research articles on any medical topic:

```json
{
  "tool": "search-medical-literature",
  "arguments": { "query": "COVID-19 treatment", "max_results": 10 }
}
```

## Data Sources

| Source                 | Coverage                                                     | Update Frequency |
| ---------------------- | ------------------------------------------------------------ | ---------------- |
| **FDA**                | All FDA-approved drugs (US)                                  | Real-time        |
| **WHO**                | Global health stats (194 countries)                          | Annual           |
| **PubMed**             | 30M+ medical citations                                       | Daily            |
| **RxNorm**             | Standardized drug nomenclature (US)                          | Weekly           |
| **Google Scholar**     | Academic papers across disciplines                           | Real-time        |
| **AAP**                | Bright Futures guidelines & policy statements                | Periodic         |
| **Pediatric Journals** | Major pediatric journals (Pediatrics, JAMA Pediatrics, etc.) | Daily            |

## Security & Privacy

- ✅ **Localhost-only** – Server runs locally, no external access
- ✅ **No data storage** – All queries are real-time, nothing saved
- ✅ **Process isolation** – Medical data stays on your machine
- ✅ **No API keys** – No credentials to manage or leak

## Use Cases

- **Medical Researchers** – Quick literature reviews without paywalls
- **Healthcare Developers** – Build prototypes with real medical data
- **Students** – Access drug information and research papers
- **Clinicians** – Reference tool for drug details and health statistics
- **Pediatricians** – AAP guidelines, Bright Futures, pediatric literature, and child health data

## Caching

The server includes an in-memory caching layer to improve response times and reduce API calls:

- **Automatic Caching**: All API responses are cached with source-specific TTL policies
- **TTL Policies**:
  - FDA data: 24 hours
  - PubMed articles: 1 hour
  - WHO statistics: 7 days
  - RxNorm nomenclature: 30 days
  - Clinical guidelines: 7 days
  - Google Scholar: 1 hour
  - Bright Futures: 30 days
  - AAP Policy: 7 days
  - Pediatric journals: 1 hour
  - Child health indicators: 7 days
  - Pediatric drugs: 24 hours
- **Cache Management**: Automatic cleanup of expired entries every 5 minutes
- **LRU Eviction**: Least recently used entries are evicted when cache exceeds 1000 entries
- **Cache Statistics**: Use `get-cache-stats` tool to view hit rates and memory usage

**Configuration** (via environment variables):

- `CACHE_ENABLED=true` - Enable/disable caching (default: true)
- `CACHE_MAX_SIZE=1000` - Maximum cache entries (default: 1000)
- `CACHE_TTL_FDA=86400` - FDA TTL in seconds (default: 86400)
- `CACHE_TTL_PUBMED=3600` - PubMed TTL in seconds (default: 3600)
- `CACHE_TTL_WHO=604800` - WHO TTL in seconds (default: 604800)
- `CACHE_TTL_RXNORM=2592000` - RxNorm TTL in seconds (default: 2592000)
- `CACHE_CLEANUP_INTERVAL=300000` - Cleanup interval in milliseconds (default: 300000)

**Performance**: Cached responses typically return in <10ms vs 800-1500ms for API calls. Expected cache hit rate: 60%+ for common queries.

## Technical Details

**Built with:** Node.js, TypeScript, MCP SDK  
**Dependencies:** `@modelcontextprotocol/sdk`, `superagent`, `puppeteer`, `zod`  
**Platforms:** macOS, Windows, Linux

**Note:** Google Scholar access uses web scraping with rate limiting. Other sources use official APIs.

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
