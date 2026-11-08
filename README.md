<div align="center">

# 🌐 OpenAPI-to-MCP Gateway

**Enterprise OpenAPI v3 & Swagger to Model Context Protocol (MCP) Gateway**  
*Instantly convert any REST API / OpenAPI spec into production-ready AI Agent Tools.*

[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-58A6FF?style=flat-square&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![Glama Inspector](https://img.shields.io/badge/Tested_with-Glama_Inspector-7C3AED?style=flat-square)](https://glama.ai/mcp/inspector)
[![BI-SNAP](https://img.shields.io/badge/Security-BI--SNAP_HMAC--SHA512-238636?style=flat-square)](samples/bi-snap-banking.yaml)
[![FinOps](https://img.shields.io/badge/Optimization-FinOps_Token_Trimmer-0D74CE?style=flat-square)](#-finops-token-cost-optimization)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Hasan_Romadon-000000?style=flat-square)](https://github.com/Hasanromadon)

<br/>

</div>

---

## 💡 Why This Project?

Enterprises, banks, and fintech organizations have thousands of established REST APIs, API Gateways (e.g., **Axway API Gateway**, Kong, Apigee), and national standards (such as **BI-SNAP / Open Banking**).

However, autonomous AI agents (Claude, Cursor, OpenAI Agents, custom LLMs) communicate via the **Model Context Protocol (MCP)**. Manually wrapping each endpoint into an MCP tool is tedious, error-prone, and unmaintainable.

**OpenAPI-to-MCP Gateway** acts as a production-grade adapter:
1. **Parses** any OpenAPI 3.0/3.1 document or Swagger URL.
2. **Eliminates Tool Bloat** with intelligent Tag & Path Whitelisting so your LLM context window doesn't get flooded.
3. **Automates BI-SNAP Cryptographic Signatures** (HMAC-SHA512 & ISO timestamps).
4. **Trims Large Payloads** via built-in FinOps optimizations to save up to 80% on LLM token costs.
5. **Provides a Local Web Playground (`/playground`)** alongside **[Glama MCP Inspector](https://glama.ai/mcp/inspector)** remote SSE support.

---

## ✨ Enterprise & Critical Features

### 1. 🛡️ Tool Filtering & Anti-Hallucination (Solves Tool Bloat)
Enterprises with hundreds of endpoints risk overflowing the LLM context window. Filter down to only what your AI agent needs:
```bash
# Only convert endpoints tagged with "accounts" or "payments"
node dist/index.js --spec api.yaml --tags accounts,payments

# Include only balance and statement endpoints
node dist/index.js --spec api.yaml --include "/v1.0/balance*,/v1.0/statement*"

# Exclude internal / admin paths
node dist/index.js --spec api.yaml --exclude "/internal/*,/admin/*"
```

### 2. 🔐 Automated BI-SNAP HMAC-SHA512 Security Hook
Complies with Bank Indonesia National Open Banking API Standard (**BI-SNAP**). When enabled, every outgoing request is automatically signed with:
- `X-TIMESTAMP`: ISO 8601 millisecond-precision timestamp.
- `X-SIGNATURE`: `Base64(HMAC-SHA512(Method + ":" + Path + ":" + SHA256(Body) + ":" + Timestamp, SecretKey))`
- `X-PARTNER-ID`, `X-EXTERNAL-ID`, and `CHANNEL-ID`.
```bash
node dist/index.js --spec samples/bi-snap-banking.yaml --bisnap --bisnap-secret "your-secret-key"
```

### 3. 💰 FinOps Token Cost Optimization
Large JSON responses (e.g. 100+ transaction rows) can blow up LLM token costs. The gateway automatically:
- Truncates oversized arrays past `--max-items` (default: 10 items) and inserts truncation notices.
- Strips null and redundant fields.
- Tracks and outputs `estimatedTokensSaved` per tool call.

### 4. 📊 Structured Audit Trail & Observability
Every execution emits an audit event for banking compliance:
```
🟢 [AUDIT] [0c5d7b66] POST /v1.0/balance-inquiry -> SUCCESS (1ms, HTTP 200, MOCK)
```

### 5. 🖥️ Built-in Interactive Web Playground (`/playground`)
Open `http://localhost:3000/playground` to inspect converted schemas and execute live test calls directly in your browser.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Hasanromadon/openapi-mcp-gateway.git
cd openapi-mcp-gateway
npm install
npm run build
```

### 2. Run with Sample Banking Spec (BI-SNAP)

```bash
# Starts gateway on port 3000 in Mock Sandbox Mode with BI-SNAP signing active
npm run demo:banking
```

### 3. Run with Corporate Cash Management Spec

```bash
npm run demo:cash-management
```

---

## 🔍 Testing with Glama MCP Inspector

[Glama MCP Inspector](https://glama.ai/mcp/inspector) is the premier browser-based testing environment for MCP servers.

### Step-by-Step:

1. **Expose your local gateway**:
   ```bash
   npx localtunnel --port 3000
   # or
   ngrok http 3000
   ```
2. **Open Glama Inspector**:
   Navigate to [glama.ai/mcp/inspector](https://glama.ai/mcp/inspector).
3. **Connect**:
   Enter your public SSE URL (e.g., `https://your-tunnel.loca.lt/sse`) and click **Connect**.
4. **Execute**:
   Test converted tools (`getAccountBalance`, `transferInterbankFunds`) and view real-time responses!

---

## 💻 Connecting to Claude Desktop / Cursor

Add this gateway to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "banking-gateway": {
      "command": "node",
      "args": [
        "/absolute/path/to/openapi-mcp-gateway/dist/index.js",
        "--spec",
        "/absolute/path/to/openapi-mcp-gateway/samples/bi-snap-banking.yaml",
        "--transport",
        "stdio",
        "--mock"
      ]
    }
  }
}
```

---

## 📂 Included Sample Specifications

| Spec Name | File | Description |
|---|---|---|
| **BI-SNAP Banking** | `samples/bi-snap-banking.yaml` | Indonesian National Open Banking standard for Balance Inquiry, Interbank Transfer, and Statements. |
| **Corporate CMS** | `samples/cash-management-api.json` | Corporate Cash Management for Bulk Payroll disbursement and Liquidity Sweeping. |

---

## 👤 Author

**Hasan Romadon**
- **Founder & Product Manager** at [asesme.com](https://asesme.com)
- **LinkedIn:** [linkedin.com/in/hasanromadon](https://linkedin.com/in/hasanromadon)
- **GitHub:** [@Hasanromadon](https://github.com/Hasanromadon)
- **Email:** hasanromadon@gmail.com

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
