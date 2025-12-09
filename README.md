# Medical MCP Server

A Model Context Protocol (MCP) server that provides comprehensive medical information by querying multiple authoritative medical APIs including FDA, WHO, PubMed, and RxNorm.

<a href="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@JamesANZ/medical-mcp/badge" alt="medical-mcp MCP server" />
</a>

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/JamesANZ/medical-mcp)](https://archestra.ai/mcp-catalog/jamesanz__medical-mcp)

## Features

This MCP server offers five specialized tools for querying medical information from reliable sources:

### 💊 Drug Information Tools

#### `search-drugs`

Search for drug information using the FDA database.

**Input:**

- `query` (string): Drug name to search for (brand name or generic name)
- `limit` (optional, number): Number of results to return (1-50, default: 10)

**Output:**

- Drug information including brand name, generic name, manufacturer, route, dosage form, and purpose

**Example:**

```
Drug Search Results for "Advil"

Found 1 drug(s)

1. **ADVIL**
   Generic Name: IBUPROFEN
   Manufacturer: PFIZER CONSUMER HEALTHCARE
   Route: ORAL
   Dosage Form: TABLET
   Purpose: For temporary relief of minor aches and pains...
   Last Updated: 20210902
```

#### `get-drug-details`

Get detailed information about a specific drug by NDC (National Drug Code).

**Input:**

- `ndc` (string): National Drug Code (NDC) of the drug

**Output:**

- Comprehensive drug information including warnings, drug interactions, and clinical pharmacology

### 📊 Health Statistics Tools

#### `get-health-statistics`

Get health statistics and indicators from WHO Global Health Observatory.

**Input:**

- `indicator` (string): Health indicator to search for (e.g., 'Life expectancy', 'Mortality rate')
- `country` (optional, string): Country code (e.g., 'USA', 'GBR')
- `limit` (optional, number): Number of results to return (1-20, default: 10)

**Output:**

- Health statistics with values, ranges, and temporal data

**Example:**

```
Health Statistics: Life expectancy at birth (years)

Country: USA
Found 10 data points

1. **USA** (2019)
   Value: 78.5 years
   Numeric Value: 78.5
   Date: 2019-12-31
```

### 🔬 Medical Literature Tools

#### `search-medical-literature`

Search for medical research articles in PubMed.

**Input:**

- `query` (string): Medical topic or condition to search for
- `max_results` (optional, number): Maximum number of articles to return (1-20, default: 10)

**Output:**

- Medical research articles with titles, PMIDs, journals, and publication dates

**Example:**

```
Medical Literature Search: "diabetes treatment"

Found 10 article(s)

1. **Novel Approaches to Diabetes Management**
   PMID: 12345678
   Journal: New England Journal of Medicine
   Publication Date: 2024-01-15
```

#### `search-google-scholar`

Search for academic research articles using Google Scholar.

**Input:**

- `query` (string): Academic topic or research query to search for

**Output:**

- Academic research articles with titles, authors, abstracts, journals, years, citations, and URLs

**Example:**

```
Google Scholar Search: "machine learning healthcare"

Found 10 article(s)

1. **Machine Learning in Healthcare: A Systematic Review**
   Authors: Smith J, Johnson A - Journal of Medical AI
   Year: 2023
   Citations: Cited by 45
   URL: https://scholar.google.com/...
   Abstract: This systematic review examines the application of machine learning...
```

**Note:** This tool uses web scraping to access Google Scholar since it doesn't provide a public API. It includes rate limiting protection and stealth measures to avoid detection.

### 🏥 Drug Nomenclature Tools

#### `search-drug-nomenclature`

Search for drug information using RxNorm (standardized drug nomenclature).

**Input:**

- `query` (string): Drug name to search for in RxNorm database

**Output:**

- Standardized drug information with RxCUI codes, synonyms, and term types

## Installation

### Installing in Cursor

You can install this MCP server directly in Cursor using the one-click install link:

**🔗 [Install in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=medical-mcp&config=eyJtZWRpY2FsLW1jcCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1lZGljYWwtbWNwIl19fQ==)**

```
cursor://anysphere.cursor-deeplink/mcp/install?name=medical-mcp&config=eyJtZWRpY2FsLW1jcCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1lZGljYWwtbWNwIl19fQ==
```

This will automatically configure the MCP server using `npx`. No API keys are required.

### Install from Source

1. Clone this repository:

```bash
git clone <repository-url>
cd medical-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Usage

### Running the Server

Start the MCP server:

```bash
npm start
```

The server runs on stdio and can be connected to any MCP-compatible client.

### Example Queries

Here are some example queries you can make with this MCP server:

#### Search for Drug Information

```json
{
  "tool": "search-drugs",
  "arguments": {
    "query": "Tylenol",
    "limit": 5
  }
}
```

#### Get Drug Details by NDC

```json
{
  "tool": "get-drug-details",
  "arguments": {
    "ndc": "00071015527"
  }
}
```

#### Get Health Statistics

```json
{
  "tool": "get-health-statistics",
  "arguments": {
    "indicator": "Life expectancy at birth (years)",
    "country": "USA",
    "limit": 5
  }
}
```

#### Search Medical Literature

```json
{
  "tool": "search-medical-literature",
  "arguments": {
    "query": "COVID-19 treatment",
    "max_results": 10
  }
}
```

#### Search Drug Nomenclature

```json
{
  "tool": "search-drug-nomenclature",
  "arguments": {
    "query": "aspirin"
  }
}
```

## API Endpoints

This MCP server integrates with the following medical APIs:

### FDA API

- `GET /drug/label.json` - Drug labeling information
- Search by brand name, generic name, or NDC
- Provides safety information, warnings, and clinical data

### WHO Global Health Observatory API

- `GET /api/Indicator` - Health statistics and indicators
- Global health data with country-specific information
- Temporal data for trend analysis

### PubMed API

- `GET /esearch.fcgi` - Search for medical articles
- `GET /efetch.fcgi` - Retrieve article details
- Access to millions of medical research papers

### RxNorm API

- `GET /REST/drugs.json` - Standardized drug nomenclature
- Drug name standardization and relationships
- Clinical drug information

### Google Scholar (Web Scraping)

- Web scraping of Google Scholar search results
- Academic research article discovery
- Citation and publication information
- **Note**: Uses Puppeteer for browser automation with anti-detection measures

## Data Sources

### FDA (Food and Drug Administration)

- **Source**: Official FDA drug labeling database
- **Coverage**: All FDA-approved drugs in the United States
- **Data**: Drug safety, efficacy, dosage, warnings, and interactions
- **Update Frequency**: Real-time as drugs are approved or labeling changes

### WHO (World Health Organization)

- **Source**: Global Health Observatory database
- **Coverage**: Global health statistics from 194 countries
- **Data**: Life expectancy, mortality rates, disease prevalence, and health indicators
- **Update Frequency**: Annual updates with historical data

### PubMed (National Library of Medicine)

- **Source**: MEDLINE database of medical literature
- **Coverage**: Over 30 million citations from medical journals
- **Data**: Research articles, clinical studies, and medical reviews
- **Update Frequency**: Daily updates as new articles are published

### RxNorm (National Library of Medicine)

- **Source**: Standardized drug nomenclature system
- **Coverage**: Clinical drugs available in the United States
- **Data**: Drug names, codes, relationships, and clinical information
- **Update Frequency**: Weekly updates

### Google Scholar (Web Scraping)

- **Source**: Google Scholar academic search engine
- **Coverage**: Academic papers, theses, books, and abstracts across all disciplines
- **Data**: Research articles, citations, authors, journals, and publication dates
- **Update Frequency**: Real-time as new papers are indexed
- **Note**: Access via web scraping with rate limiting protection

## Error Handling

The server includes comprehensive error handling:

- Network errors are caught and reported with descriptive messages
- Invalid queries return appropriate error messages
- Rate limiting and API errors are handled gracefully
- Fallback responses when specific APIs are unavailable

## Web Scraping Implementation

The Google Scholar integration uses Puppeteer for web scraping with the following features:

### Anti-Detection Measures

- **Stealth Mode**: Browser launched with multiple flags to avoid detection
- **User Agent Spoofing**: Realistic browser user agent strings
- **Random Delays**: Built-in delays between requests to avoid rate limiting
- **Header Spoofing**: Realistic HTTP headers to appear as a regular browser
- **Viewport Settings**: Standard desktop viewport dimensions

### Robust Parsing

- **Multiple Selectors**: Uses various CSS selectors to handle different Google Scholar layouts
- **Fallback Strategies**: Multiple parsing approaches for different page structures
- **Error Recovery**: Graceful handling of missing elements or changed page structures
- **Data Validation**: Filters out incomplete or invalid results

### Rate Limiting Protection

- **Random Delays**: 1-3 second random delays between requests
- **Browser Management**: Proper browser cleanup to prevent resource leaks
- **Timeout Handling**: Configurable timeouts for network requests
- **Error Recovery**: Automatic retry logic for failed requests

## 🚀 Usage

### **Stdio Mode (Default - Most Secure)**

```bash
# Build and run in stdio mode (inherently localhost-only)
npm run build
npm start

# Or directly
node build/index.js
```

### **HTTP Mode (Localhost-Only)**

```bash
# HTTP server on localhost only (port 3000)
npm run start:http

# Custom port
npm run start:http:port
# or
node build/index.js --http --port=8080

# Test localhost access
curl http://localhost:3000/info
```

### **Development Mode**

```bash
# Build and run stdio
npm run dev

# Build and run HTTP
npm run dev:http
```

## 🤖 Claude Desktop Integration

### **Setup Instructions**

#### **1. Install and Build the Server**

```bash
# Clone the repository
git clone https://github.com/JamesANZ/medical-mcp.git
cd medical-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

#### **2. Configure Claude Desktop**

Create or edit your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "node",
      "args": ["/path/to/medical-mcp/build/index.js"],
      "cwd": "/path/to/medical-mcp"
    }
  }
}
```

**Replace the paths with your actual installation directory:**

**For users with NVM (Node Version Manager):**

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "/Users/yourusername/.nvm/versions/node/v22.17.0/bin/node",
      "args": [
        "/Users/yourusername/Documents/projects/medical-mcp/build/index.js"
      ]
    }
  }
}
```

**For users with system Node.js:**

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "node",
      "args": ["/Users/yourusername/medical-mcp/build/index.js"],
      "cwd": "/Users/yourusername/medical-mcp"
    }
  }
}
```

**To find your Node.js path:**

```bash
# If using NVM
which node
# Example output: /Users/yourusername/.nvm/versions/node/v22.17.0/bin/node

# If using system Node.js
which node
# Example output: /usr/local/bin/node
```

#### **3. Restart Claude Desktop**

- Close Claude Desktop completely
- Reopen Claude Desktop
- The Medical MCP Server will start automatically

### **Available Medical Tools in Claude**

Once connected, you'll have access to these medical tools:

#### **🔍 Search Tools**

- `search-drugs` - Search FDA drug database
- `search-pubmed-articles` - Search medical literature
- `search-google-scholar` - Search academic research
- `search-medical-databases` - Comprehensive multi-database search
- `search-medical-journals` - Search top medical journals

#### **💊 Drug Information Tools**

- `get-drug-by-ndc` - Get drug details by NDC code
- ~~`check-drug-interactions`~~ - **REMOVED** (dangerous false negatives)
- `get-drug-safety-info` - Get drug safety information

#### **🏥 Clinical Tools**

- `generate-differential-diagnosis` - Generate differential diagnoses
- `get-diagnostic-criteria` - Get diagnostic criteria for conditions
- `get-risk-calculators` - Get clinical risk calculators
- `get-lab-values` - Get normal lab value ranges

#### **📊 Health Data Tools**

- `get-health-indicators` - Get WHO health statistics
- `search-rxnorm-drugs` - Search RxNorm drug database
- `search-clinical-guidelines` - Search clinical guidelines

### **Example Claude Conversations**

#### **Drug Information Query**

```
User: "What are the side effects of metformin and can it interact with lisinopril?"

Claude will use:
- search-drugs for metformin information
- search-drugs for metformin information
- get-drug-safety-info for detailed safety data
```

#### **Clinical Decision Support**

```
User: "A 45-year-old patient presents with chest pain, shortness of breath, and diaphoresis. What should I consider?"

Claude will use:
- generate-differential-diagnosis for possible conditions
- get-diagnostic-criteria for specific diagnostic criteria
- search-medical-databases for latest research
```

#### **Research and Literature Review**

```
User: "Find recent research on COVID-19 treatment protocols"

Claude will use:
- search-pubmed-articles for medical literature
- search-medical-journals for top-tier research
- search-google-scholar for additional academic sources
```

### **🔒 Security Features in Claude**

- **Localhost-Only**: Server runs locally, no external access
- **Process Isolation**: Medical data stays on your machine
- **No Data Storage**: No medical data is stored locally
- **Dynamic Data**: All information retrieved in real-time
- **Audit Logging**: All queries are logged for transparency

### **Troubleshooting**

#### **Server Won't Start**

```bash
# Check if the server builds correctly
npm run build

# Test the server directly
node build/index.js

# Check for port conflicts
lsof -i :3000
```

#### **Claude Can't Connect**

1. Verify the configuration file path is correct
2. Ensure the server executable path is absolute
3. Check that Node.js is in your PATH
4. Restart Claude Desktop after configuration changes

#### **Permission Issues**

```bash
# Make sure the executable has proper permissions
chmod 755 build/index.js

# On macOS, you might need to allow Node.js in Security & Privacy
```

#### **Network Issues**

- The server uses localhost-only binding for security
- No external network access required for the server itself
- Medical data is fetched from external APIs when needed

### **Best Practices**

#### **For Medical Professionals**

- Always verify information through multiple sources
- Use as a starting point for research, not final decisions
- Follow established clinical guidelines
- Document your decision-making process

#### **For Students and Researchers**

- Use for literature reviews and research
- Cross-reference with primary sources
- Understand the limitations of AI-generated summaries
- Always cite original sources

#### **For General Users**

- Use for educational purposes only
- Never replace professional medical advice
- Consult healthcare providers for medical decisions
- Be aware of information limitations

### **Advanced Configuration**

#### **Custom Port (if needed)**

```json
{
  "mcpServers": {
    "medical-mcp": {
      "command": "node",
      "args": ["/path/to/medical-mcp/build/index.js", "--http", "--port=3001"],
      "cwd": "/path/to/medical-mcp"
    }
  }
}
```

#### **Environment Variables**

```bash
# Set custom API timeouts
export MCP_TIMEOUT=30000

# Set custom user agent
export MCP_USER_AGENT="Medical-Research-Tool/1.0"
```

## 🔒 Security Verification

### **Test Localhost Access**

```bash
# Should work (localhost)
curl http://localhost:3000/info

# Should be blocked (external IP)
curl http://YOUR_EXTERNAL_IP:3000/info
# Returns: "Access denied: This server is restricted to localhost only"
```

### **Check Binding**

```bash
# Verify server is bound to localhost only
netstat -an | grep :3000
# Should show: 127.0.0.1:3000 (not 0.0.0.0:3000)
```

## Medical Disclaimer

**Important**: This MCP server provides information from authoritative medical sources but should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals for medical decisions.

- The information provided is for educational and informational purposes only
- Drug information may not be complete or up-to-date for all medications
- Health statistics are aggregated data and may not reflect individual circumstances
- Medical literature should be interpreted by qualified healthcare professionals

## Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for server implementation
- `superagent` - HTTP client for API requests
- `puppeteer` - Browser automation for web scraping Google Scholar
- `zod` - Schema validation for tool parameters

## Donate

If you find this project useful, consider supporting it with Bitcoin:

**⚡ Lightning Network**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/lightning.jpeg" alt="Lightning QR Code" width="120" />

<code>lnbc1pjhhsqepp5mjgwnvg0z53shm22hfe9us289lnaqkwv8rn2s0rtekg5vvj56xnqdqqcqzzsxqyz5vqsp5gu6vh9hyp94c7t3tkpqrp2r059t4vrw7ps78a4n0a2u52678c7yq9qyyssq7zcferywka50wcy75skjfrdrk930cuyx24rg55cwfuzxs49rc9c53mpz6zug5y2544pt8y9jflnq0ltlha26ed846jh0y7n4gm8jd3qqaautqa</code>

**₿ On-Chain**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/onchain.jpg" alt="Bitcoin Address QR Code" width="120" />

<code>[bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp](https://mempool.space/address/bc1ptzvr93pn959xq4et6sqzpfnkk2args22ewv5u2th4ps7hshfaqrshe0xtp)</code>

**Ξ Ethereum / EVM Networks**

<img src="https://raw.githubusercontent.com/bitcoinwarrior1/CitySats/main/public/ethereum.jpg" alt="Ethereum Address QR Code" width="120" />

<code>[0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f](https://etherscan.io/address/0x42ea529282DDE0AA87B42d9E83316eb23FE62c3f)</code>

*Donations from any EVM-compatible network (Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, etc.) will work perfectly! You can also send tokens like USDT, USDC, DAI, and other ERC-20 tokens to this address.*

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
