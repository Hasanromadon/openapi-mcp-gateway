import axios from 'axios';
import { ParsedTool, GatewayConfig } from './types.js';

export async function executeToolCall(
  tool: ParsedTool,
  args: Record<string, any>,
  config: GatewayConfig
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // If Mock mode is enabled, generate an intelligent mock response
  if (config.mock) {
    const mockData = generateMockResponse(tool, args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockData, null, 2),
        },
      ],
    };
  }

  const baseUrl = config.baseUrl || 'http://localhost:8080';
  let targetUrl = `${baseUrl.replace(/\/$/, '')}${tool.path}`;

  const queryParams: Record<string, any> = {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.defaultHeaders || {}),
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const bodyData: Record<string, any> = {};

  // Map arguments to path, query, header, or body
  for (const [key, value] of Object.entries(args || {})) {
    const matchingParam = tool.parameters.find((p) => p.name === key);

    if (matchingParam) {
      if (matchingParam.in === 'path') {
        targetUrl = targetUrl.replace(`{${key}}`, encodeURIComponent(String(value)));
      } else if (matchingParam.in === 'query') {
        queryParams[key] = value;
      } else if (matchingParam.in === 'header') {
        headers[key] = String(value);
      }
    } else if (key === 'requestBody') {
      Object.assign(bodyData, value);
    } else {
      const cleanKey = key.startsWith('body_') ? key.slice(5) : key;
      bodyData[cleanKey] = value;
    }
  }

  try {
    const response = await axios({
      method: tool.method,
      url: targetUrl,
      params: queryParams,
      headers,
      data: Object.keys(bodyData).length > 0 ? bodyData : undefined,
      validateStatus: () => true, // Don't throw on 4xx/5xx to capture full payload
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
              data: response.data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: error.message || 'Failed to dispatch request to upstream API',
              url: targetUrl,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

function generateMockResponse(tool: ParsedTool, args: Record<string, any>): any {
  const successResponse =
    tool.responses?.['200'] ||
    tool.responses?.['201'] ||
    tool.responses?.default;

  const schema = successResponse?.content?.['application/json']?.schema;

  return {
    _mockMode: true,
    _gateway: 'openapi-mcp-gateway by Hasan Romadon',
    timestamp: new Date().toISOString(),
    operation: tool.name,
    endpoint: `${tool.method} ${tool.path}`,
    echoInputs: args,
    responseCode: '2000000',
    responseMessage: 'Request processed successfully via OpenAPI-to-MCP Gateway',
    data: schema?.example || schema?.properties ? buildMockFromSchema(schema) : {
      status: 'SUCCESS',
      referenceNo: `REF-${Date.now().toString(36).toUpperCase()}`,
      partnerReferenceNo: args.partnerReferenceNo || `PARTNER-${Math.floor(Math.random() * 1000000)}`,
    },
  };
}

function buildMockFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return {};
  if (schema.example) return schema.example;

  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, any> = {};
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      obj[key] = buildMockFromSchema(prop);
    }
    return obj;
  }

  if (schema.type === 'array') {
    return [buildMockFromSchema(schema.items || {})];
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return schema.default !== undefined ? schema.default : 1000000;
  }

  if (schema.type === 'boolean') {
    return true;
  }

  return schema.default || `${schema.description || 'mock_value'}`;
}
