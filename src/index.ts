#!/usr/bin/env node
import { Command } from 'commander';
import { loadOpenAPISpec } from './parser.js';
import { runSseServer, runStdioServer } from './server.js';
import { GatewayConfig } from './types.js';

const program = new Command();

program
  .name('openapi-mcp-gateway')
  .description('Enterprise OpenAPI v3 & Swagger to Model Context Protocol (MCP) Gateway')
  .version('1.0.0')
  .option('-s, --spec <pathOrUrl>', 'Path or URL to OpenAPI specification file (JSON/YAML)', 'samples/bi-snap-banking.yaml')
  .option('-p, --port <port>', 'Port to run SSE server on', '3000')
  .option('-t, --transport <transport>', 'Transport type: sse (default) or stdio', 'sse')
  .option('-m, --mock', 'Enable mock response mode based on OpenAPI schema', false)
  .option('-u, --base-url <url>', 'Override target API base URL')
  .option('-k, --api-key <key>', 'Bearer token or API key for upstream requests')
  .action(async (options) => {
    try {
      const config: GatewayConfig = {
        specPathOrUrl: options.spec,
        port: parseInt(options.port, 10),
        transport: options.transport as 'sse' | 'stdio',
        mock: !!options.mock,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
      };

      const spec = await loadOpenAPISpec(config.specPathOrUrl);

      if (config.transport === 'stdio') {
        await runStdioServer(spec, config);
      } else {
        await runSseServer(spec, config);
      }
    } catch (err: any) {
      console.error('❌ Error initializing OpenAPI MCP Gateway:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
