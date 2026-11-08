export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface ParsedToolParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any;
}

export interface ParsedTool {
  name: string;
  description: string;
  method: string;
  path: string;
  tags: string[];
  parameters: ParsedToolParameter[];
  requestBodySchema?: any;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  responses?: Record<string, any>;
}

export interface BiSnapSecurityConfig {
  enabled: boolean;
  partnerId?: string;
  clientSecret?: string;
  channelId?: string;
}

export interface GatewayConfig {
  specPathOrUrl: string;
  baseUrl?: string;
  port?: number;
  transport?: 'sse' | 'stdio';
  mock?: boolean;
  defaultHeaders?: Record<string, string>;
  apiKey?: string;
  // Feature 1: Filter & Whitelist
  includeTags?: string[];
  includePaths?: string[];
  excludePaths?: string[];
  // Feature 2: BI-SNAP Security
  biSnap?: BiSnapSecurityConfig;
  // Feature 3: Response FinOps Trimming
  maxArrayItems?: number;
  maxPayloadBytes?: number;
  // Feature 4: Audit Logging
  auditLog?: boolean;
}

export interface AuditLogEvent {
  traceId: string;
  timestamp: string;
  tool: string;
  method: string;
  path: string;
  durationMs: number;
  status: 'SUCCESS' | 'ERROR';
  statusCode?: number;
  errorMessage?: string;
  mock: boolean;
}
