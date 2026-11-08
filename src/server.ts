import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
import { renderPlaygroundHtml } from './ui/playground.js';

export function createMcpServer(spec: OpenAPISpec, config: GatewayConfig) {
  const tools: ParsedTool[] = convertOpenApiToMcpTools(spec, config);
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
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
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

function createHttpGuards(config: GatewayConfig): express.RequestHandler[] {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const authenticate: express.RequestHandler = (req, res, next) => {
    if (!config.mcpAuthToken) return next();
    const authorization = req.header('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    const supplied = match?.[1] || '';
    const expectedBuffer = Buffer.from(config.mcpAuthToken);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return next();
    }
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({ error: 'Unauthorized' });
  };

  const rateLimit: express.RequestHandler = (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + 60_000 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > 120) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      return;
    }
    if (buckets.size > 10_000) {
      for (const [ip, entry] of buckets) if (entry.resetAt <= now) buckets.delete(ip);
    }
    next();
  };

  return [rateLimit, authenticate];
}

/** Stateless-per-request Streamable HTTP endpoint for remote MCP clients. */
export async function runStreamableHttpServer(spec: OpenAPISpec, config: GatewayConfig) {
  const port = config.port || 3000;
  const app = express();
  app.use(cors());
  app.use(express.json());
  const httpGuards = createHttpGuards(config);

  app.all('/mcp', ...httpGuards, async (req, res) => {
    try {
      const { server } = createMcpServer(spec, config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling Streamable HTTP MCP request:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.listen(port, () => {
    console.log(`🚀 OpenAPI-to-MCP Gateway listening on http://0.0.0.0:${port}/mcp (Streamable HTTP)`);
    console.log(`📂 Spec: ${spec.info.title} (v${spec.info.version}), ${convertOpenApiToMcpTools(spec, config).length} tools`);
    console.log(`🔌 Mode: ${config.mock ? 'Mock / Sandbox' : 'Live API Proxy'}`);
  });
}

export async function runSseServer(spec: OpenAPISpec, config: GatewayConfig) {
  const port = config.port || 3000;
  const app = express();

  // Enable CORS for Glama Inspector and browser-based testing
  app.use(cors());
  app.use(express.json());
  const httpGuards = createHttpGuards(config);

  const { server, tools } = createMcpServer(spec, config);
  const toolMap = new Map<string, ParsedTool>(tools.map((t) => [t.name, t]));
  let transport: SSEServerTransport | null = null;

  // SSE endpoint for Glama Inspector
  app.get('/sse', ...httpGuards, async (req, res) => {
    console.log('📡 [SSE Connection] Client connected to /sse (e.g. Glama Inspector)');
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);

    req.on('close', () => {
      console.log('🔌 [SSE Connection] Client disconnected');
    });
  });

  // Message handler for incoming JSON-RPC requests
  app.post('/messages', ...httpGuards, async (req, res) => {
    if (!transport) {
      res.status(400).json({ error: 'SSE connection must be established before sending messages.' });
      return;
    }
    await transport.handlePostMessage(req, res);
  });

  // API endpoint for interactive playground execution
  app.post('/api/tools/execute', ...httpGuards, async (req, res) => {
    const { name, arguments: args } = req.body;
    const tool = toolMap.get(name);
    if (!tool) {
      res.status(404).json({ error: `Tool not found: ${name}` });
      return;
    }
    try {
      const result = await executeToolCall(tool, args || {}, config);
      res.json(JSON.parse(result.content[0].text));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Interactive Web Playground & Dashboard
  app.get('/playground', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderPlaygroundHtml(spec, tools, config));
  });

  // Root endpoint: HTML if browser, JSON if API client
  app.get('/', (req, res) => {
    if (req.headers.accept?.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html');
      res.send(renderPlaygroundHtml(spec, tools, config));
      return;
    }

    res.json({
      name: 'openapi-mcp-gateway',
      author: 'Hasan Romadon',
      title: spec.info.title,
      version: spec.info.version,
      mockMode: !!config.mock,
      biSnapEnabled: !!config.biSnap?.enabled,
      toolsCount: tools.length,
      tools: tools.map((t) => ({ name: t.name, method: t.method, path: t.path, tags: t.tags })),
      sseEndpoint: `http://localhost:${port}/sse`,
      playgroundUrl: `http://localhost:${port}/playground`,
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
      if (config.biSnap?.enabled) {
        console.log(`🔐 Security: BI-SNAP Dynamic HMAC-SHA512 Signature Active`);
      }
      if (config.includeTags?.length) {
        console.log(`🏷️ Tags Filter: [${config.includeTags.join(', ')}]`);
      }
      console.log(`🌐 Web Playground: http://localhost:${port}/playground`);
      console.log(`📡 SSE Endpoint: http://localhost:${port}/sse`);
      console.log('\n🔍 How to test in Glama Inspector:');
      console.log(`   1. Open https://glama.ai/mcp/inspector`);
      console.log(`   2. In Server URL, enter your SSE address (e.g. via ngrok/localtunnel)`);
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
