<div align="center">

# 🌐 OpenAPI-to-MCP Gateway

**Enterprise OpenAPI v3 & Swagger to Model Context Protocol (MCP) Gateway**  
*Instantly convert any REST API / OpenAPI spec into production-ready AI Agent Tools.*

[![MCP](https://img.shields.io/badge/MCP-Model_Context_Protocol-58A6FF?style=flat-square&logo=anthropic&logoColor=white)](https://modelcontextprotocol.io)
[![Glama Inspector](https://img.shields.io/badge/Tested_with-Glama_Inspector-7C3AED?style=flat-square)](https://glama.ai/mcp/inspector)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Hasan_Romadon-000000?style=flat-square)](https://github.com/Hasanromadon)

<br/>

</div>

---

## 💡 Why This Project?

Enterprises, banks, and fintech organizations have thousands of established REST APIs, API Gateways (e.g., **Axway API Gateway**, Kong, Apigee), and national standards (such as **BI-SNAP / Open Banking**).

However, autonomous AI agents (Claude, Cursor, OpenAI Agents, custom LLMs) communicate via the **Model Context Protocol (MCP)**. Manually wrapping each endpoint into an MCP tool is tedious, error-prone, and unmaintainable.

**OpenAPI-to-MCP Gateway** solves this problem by serving as an intelligent adapter:
1. **Parses** any OpenAPI 3.0/3.1 document or Swagger URL.
2. **Generates** MCP-compliant Tool schemas on the fly.
3. **Exposes** an **SSE (Server-Sent Events)** endpoint ready for **[Glama MCP Inspector](https://glama.ai/mcp/inspector)** and remote agents.
4. **Proxies** tool executions directly to your backend or simulates realistic responses in **Mock Sandbox Mode**.

---

## ✨ Features

- 🔄 **Zero-Code Conversion**: Feed any JSON/YAML OpenAPI spec and get MCP tools automatically.
- 📡 **Dual Transports**:
  - **SSE / HTTP**: Built for web-based inspectors like [Glama Inspector](https://glama.ai/mcp/inspector), cloud deployments, and remote AI agents.
  - **Stdio**: Native integration for **Claude Desktop**, **Cursor**, and local CLI agent workflows.
- 🧪 **Mock Sandbox Engine**: Test your tools in Glama Inspector immediately without needing a live backend database. Generates realistic payloads compliant with the response schemas.
- 🏦 **Enterprise & Banking Ready**: Includes samples for **Bank Indonesia Open Banking (BI-SNAP)** and **Corporate Cash Management System (CMS)**.
- 🔐 **Security & Header Passthrough**: Supports Bearer tokens, API Keys, and custom headers (e.g., `X-PARTNER-ID`, `X-SIGNATURE`).

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
# Run in Mock mode on port 3000
npm run demo:banking
```

Output:
```
=============================================================
🚀 OpenAPI-to-MCP Gateway is running!
📂 Spec: Bank Indonesia Fast & Open API (BI-SNAP) (v1.0.0)
🛠️ Converted Tools: 3 MCP tools generated
🔌 Mode: Mock / Sandbox (Auto-generates responses)
🌐 Server URL: http://localhost:3000
📡 SSE Endpoint: http://localhost:3000/sse
=============================================================
```

### 3. Run with Corporate Cash Management Spec

```bash
npm run demo:cash-management
```

### 4. Run with Your Own OpenAPI Spec or URL

```bash
# Local YAML/JSON spec
node dist/index.js --spec /path/to/your-api.yaml --port 3000 --mock

# Remote URL spec against live backend
node dist/index.js --spec https://petstore.swagger.io/v2/swagger.json --base-url https://petstore.swagger.io/v2 --port 3000
```

---

## 🔍 Testing with Glama MCP Inspector

[Glama MCP Inspector](https://glama.ai/mcp/inspector) is the premier browser-based testing environment for MCP servers.

### Step-by-Step:

1. **Expose your local gateway** (if testing from browser):
   ```bash
   npx localtunnel --port 3000
   # or
   ngrok http 3000
   ```
2. **Open Glama Inspector**:
   Navigate to [glama.ai/mcp/inspector](https://glama.ai/mcp/inspector).
3. **Connect**:
   - In the **Server URL** input, enter your public SSE URL:
     ```
     https://your-tunnel-url.loca.lt/sse
     ```
   - Click **Connect**.
4. **Inspect & Execute**:
   - View your converted operations (`getAccountBalance`, `transferInterbankFunds`, etc.).
   - Execute tool calls with custom test inputs and inspect real-time responses!

---

## 💻 Connecting to Claude Desktop

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

## 🏗️ Architecture

```
┌────────────────────────────────┐         ┌──────────────────────────────┐
│  OpenAPI Spec / Swagger        │         │   Glama MCP Inspector        │
│  (BI-SNAP, Axway, REST APIs)   │         │   Claude Desktop / Cursor    │
└───────────────┬────────────────┘         └──────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  OpenAPI-to-MCP Gateway                     │
   │                                                             │
   │  ┌───────────────┐     ┌──────────────┐     ┌────────────┐  │
   │  │ OpenAPI Parser│ ──> │ Tool Builder │ ──> │ MCP Server │  │
   │  └───────────────┘     └──────────────┘     └─────┬──────┘  │
   │                                                   │         │
   │  ┌───────────────────────┐                        ▼         │
   │  │ Mock Response Engine  │ <── Tool Call ── [ SSE / Stdio ] │
   │  └───────────────────────┘                                  │
   └───────────────────────────┬─────────────────────────────────┘
                               │ (Live Mode)
                               ▼
                 ┌───────────────────────────┐
                 │ Upstream Enterprise APIs  │
                 │ (Axway, Core Banking, CMS)│
                 └───────────────────────────┘
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
