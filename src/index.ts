#!/usr/bin/env node
import { Command } from 'commander';
import { loadOpenAPISpec } from './parser.js';
import { runSseServer, runStdioServer, runStreamableHttpServer } from './server.js';
import { GatewayConfig } from './types.js';

const program = new Command();

program
  .name('openapi-mcp-gateway')
  .description('Enterprise OpenAPI v3 & Swagger to Model Context Protocol (MCP) Gateway')
  .version('1.1.0')
  .option('-s, --spec <pathOrUrl>', 'Path or URL to OpenAPI specification file (JSON/YAML)', process.env.SPEC || 'samples/bi-snap-banking.yaml')
  .option('-p, --port <port>', 'Port to run HTTP server on', process.env.PORT || '3000')
  .option('-t, --transport <transport>', 'Transport type: streamable-http, sse, or stdio', process.env.TRANSPORT || 'sse')
  .option('-m, --mock', 'Enable mock response mode based on OpenAPI schema', process.env.MOCK === 'true')
  .option('-u, --base-url <url>', 'Override target API base URL', process.env.BASE_URL)
  .option('-k, --api-key <key>', 'Bearer token or API key for upstream requests', process.env.API_KEY)
  .option('--mcp-auth-token <token>', 'Require this bearer token for HTTP MCP requests', process.env.MCP_AUTH_TOKEN)
  .option('--allowed-upstream-hosts <hosts>', 'Comma-separated upstream host allowlist required for live mode', process.env.ALLOWED_UPSTREAM_HOSTS)
  // Optimization 1: Tag & Path Filtering
  .option('--tags <tags>', 'Filter tools by OpenAPI tags (comma-separated, e.g. accounts,transfers)')
  .option('--include <patterns>', 'Filter tools by path pattern (comma-separated, e.g. /v1.0/balance*,/v1.0/transfer*)')
  .option('--exclude <patterns>', 'Exclude tools by path pattern (comma-separated, e.g. /internal/*)')
  // Optimization 2: BI-SNAP Dynamic Cryptographic Security
  .option('--bisnap', 'Enable automated Bank Indonesia SNAP (BI-SNAP) HMAC-SHA512 signing & timestamping', process.env.BISNAP === 'true')
  .option('--bisnap-secret <secret>', 'BI-SNAP Client Secret for HMAC signature generation', process.env.BISNAP_SECRET)
  .option('--bisnap-partner <partnerId>', 'BI-SNAP Partner ID', process.env.BISNAP_PARTNER_ID)
  .option('--bisnap-channel <channelId>', 'BI-SNAP Channel ID', process.env.BISNAP_CHANNEL_ID)
  // Optimization 3: FinOps Token Trimming
  .option('--max-items <count>', 'Maximum array items to return before trimming (FinOps token saver)', '10')
  .action(async (options) => {
    try {
      const config: GatewayConfig = {
        specPathOrUrl: options.spec,
        port: parseInt(options.port, 10),
        transport: options.transport as 'sse' | 'streamable-http' | 'stdio',
        mock: !!options.mock,
        baseUrl: options.baseUrl,
        apiKey: options.apiKey,
        mcpAuthToken: options.mcpAuthToken,
        allowedUpstreamHosts: options.allowedUpstreamHosts
          ? options.allowedUpstreamHosts.split(',').map((host: string) => host.trim().toLowerCase()).filter(Boolean)
          : undefined,
        includeTags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
        includePaths: options.include ? options.include.split(',').map((p: string) => p.trim()) : undefined,
        excludePaths: options.exclude ? options.exclude.split(',').map((p: string) => p.trim()) : undefined,
        biSnap: {
          enabled: !!options.bisnap,
          clientSecret: options.bisnapSecret,
          partnerId: options.bisnapPartner,
          channelId: options.bisnapChannel,
        },
        maxArrayItems: parseInt(options.maxItems, 10),
      };

      if (config.biSnap?.enabled && (!config.biSnap.clientSecret || !config.biSnap.partnerId || !config.biSnap.channelId)) {
        throw new Error('BI-SNAP signing requires BISNAP_SECRET, BISNAP_PARTNER_ID, and BISNAP_CHANNEL_ID.');
      }

      const spec = await loadOpenAPISpec(config.specPathOrUrl);

      if (!config.mock && !config.allowedUpstreamHosts?.length) {
        throw new Error('Live mode requires ALLOWED_UPSTREAM_HOSTS (or --allowed-upstream-hosts) to restrict outbound API calls.');
      }

      if (config.transport === 'stdio') {
        await runStdioServer(spec, config);
      } else if (config.transport === 'streamable-http') {
        await runStreamableHttpServer(spec, config);
      } else {
        await runSseServer(spec, config);
      }
    } catch (err: any) {
      console.error('❌ Error initializing OpenAPI MCP Gateway:', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
