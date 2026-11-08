#!/usr/bin/env node
import { Command } from 'commander';
import { loadOpenAPISpec } from './parser.js';
import { runSseServer, runStdioServer } from './server.js';
import { GatewayConfig } from './types.js';

const program = new Command();

program
  .name('openapi-mcp-gateway')
  .description('Enterprise OpenAPI v3 & Swagger to Model Context Protocol (MCP) Gateway')
  .version('1.1.0')
  .option('-s, --spec <pathOrUrl>', 'Path or URL to OpenAPI specification file (JSON/YAML)', 'samples/bi-snap-banking.yaml')
  .option('-p, --port <port>', 'Port to run SSE server on', '3000')
  .option('-t, --transport <transport>', 'Transport type: sse (default) or stdio', 'sse')
  .option('-m, --mock', 'Enable mock response mode based on OpenAPI schema', false)
  .option('-u, --base-url <url>', 'Override target API base URL')
  .option('-k, --api-key <key>', 'Bearer token or API key for upstream requests')
  // Optimization 1: Tag & Path Filtering
  .option('--tags <tags>', 'Filter tools by OpenAPI tags (comma-separated, e.g. accounts,transfers)')
  .option('--include <patterns>', 'Filter tools by path pattern (comma-separated, e.g. /v1.0/balance*,/v1.0/transfer*)')
  .option('--exclude <patterns>', 'Exclude tools by path pattern (comma-separated, e.g. /internal/*)')
  // Optimization 2: BI-SNAP Dynamic Cryptographic Security
  .option('--bisnap', 'Enable automated Bank Indonesia SNAP (BI-SNAP) HMAC-SHA512 signing & timestamping', false)
  .option('--bisnap-secret <secret>', 'BI-SNAP Client Secret for HMAC signature generation')
  .option('--bisnap-partner <partnerId>', 'BI-SNAP Partner ID')
  // Optimization 3: FinOps Token Trimming
  .option('--max-items <count>', 'Maximum array items to return before trimming (FinOps token saver)', '10')
  .action(async (options) => {
    try {
      const config: GatewayConfig = {
        specPathOrUrl: options.spec,
        port: parseInt(options.port, 10),
        transport: options.transport as 'sse' | 'stdio',
        mock: !!options.mock,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        includeTags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
        includePaths: options.include ? options.include.split(',').map((p: string) => p.trim()) : undefined,
        excludePaths: options.exclude ? options.exclude.split(',').map((p: string) => p.trim()) : undefined,
        biSnap: {
          enabled: !!options.bisnap,
          clientSecret: options.bisnapSecret,
          partnerId: options.bisnapPartner,
        },
        maxArrayItems: parseInt(options.maxItems, 10),
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
