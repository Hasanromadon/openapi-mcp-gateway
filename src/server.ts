import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAPISpec, ParsedTool, GatewayConfig } from './types.js';
import { convertOpenApiToMcpTools } from './converter.js';
import { executeToolCall } from './executor.js';

export function createMcpServer(spec: OpenAPISpec, config: GatewayConfig) {
  const tools: ParsedTool[] = convertOpenApiToMcpTools(spec);
  const toolMap = new Map<string, ParsedTool>(tools.map((t) => [t.name, t]));

  const server = new Server(
    {
      name: `openapi-mcp-gateway (${spec.info.title})`,
      version: spec.info.version || '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }

    return await executeToolCall(tool, args || {}, config);
  });

  return { server, tools };
}

export async function runSseServer(spec: OpenAPISpec, config: GatewayConfig) {
  const port = config.port || 3000;
  const app = express();

  // Enable CORS for Glama Inspector and browser-based testing
  app.use(cors());
  app.use(express.json());

  const { server, tools } = createMcpServer(spec, config);
  let transport: SSEServerTransport | null = null;

  // SSE endpoint for Glama Inspector
  app.get('/sse', async (req, res) => {
    console.log('📡 [SSE Connection] Client connected to /sse (e.g. Glama Inspector)');
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);

    req.on('close', () => {
      console.log('🔌 [SSE Connection] Client disconnected');
    });
  });

  // Message handler for incoming JSON-RPC requests
  app.post('/messages', async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: 'SSE connection must be established before sending messages.' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // Health check & Info endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'openapi-mcp-gateway',
      author: 'Hasan Romadon',
      title: spec.info.title,
      version: spec.info.version,
      mockMode: !!config.mock,
      toolsCount: tools.length,
      tools: tools.map((t) => ({ name: t.name, method: t.method, path: t.path })),
      sseEndpoint: `http://localhost:${port}/sse`,
      glamaInspectorUrl: `https://glama.ai/mcp/inspector`,
    });
  });

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log('\n=============================================================');
      console.log(`🚀 OpenAPI-to-MCP Gateway is running!`);
      console.log(`📂 Spec: ${spec.info.title} (v${spec.info.version})`);
      console.log(`🛠️ Converted Tools: ${tools.length} MCP tools generated`);
      console.log(`🔌 Mode: ${config.mock ? 'Mock / Sandbox (Auto-generates responses)' : 'Live API Proxy'}`);
      console.log(`🌐 Server URL: http://localhost:${port}`);
      console.log(`📡 SSE Endpoint: http://localhost:${port}/sse`);
      console.log('\n🔍 How to test in Glama Inspector:');
      console.log(`   1. Open https://glama.ai/mcp/inspector`);
      console.log(`   2. In Server URL, enter your SSE address (e.g. via ngrok/localtunnel or public URL)`);
      console.log(`   3. Click Connect & inspect all converted tools!`);
      console.log('=============================================================\n');
      resolve();
    });
  });
}

export async function runStdioServer(spec: OpenAPISpec, config: GatewayConfig) {
  const { server } = createMcpServer(spec, config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`🚀 OpenAPI-to-MCP Gateway running via stdio (${spec.info.title})`);
}
