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
  parameters: ParsedToolParameter[];
  requestBodySchema?: any;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  responses?: Record<string, any>;
}

export interface GatewayConfig {
  specPathOrUrl: string;
  baseUrl?: string;
  port?: number;
  transport?: 'sse' | 'stdio';
  mock?: boolean;
  defaultHeaders?: Record<string, string>;
  apiKey?: string;
}
