import axios from 'axios';
import crypto from 'node:crypto';
import { ParsedTool, GatewayConfig, AuditLogEvent } from './types.js';
import { signBiSnapRequest } from './security/bisnap.js';
import { trimPayload } from './finops.js';

export async function executeToolCall(
  tool: ParsedTool,
  args: Record<string, any>,
  config: GatewayConfig
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const startTime = Date.now();
  const traceId = crypto.randomUUID();

  // If Mock mode is enabled, generate an intelligent mock response
  if (config.mock) {
    const mockData = generateMockResponse(tool, args);
    const durationMs = Date.now() - startTime;

    logAuditEvent({
      traceId,
      timestamp: new Date().toISOString(),
      tool: tool.name,
      method: tool.method,
      path: tool.path,
      durationMs,
      status: 'SUCCESS',
      statusCode: 200,
      mock: true,
    }, config);

    const { data: optimizedData, estimatedTokensSaved } = trimPayload(
      mockData,
      config.maxArrayItems || 10
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ...optimizedData,
              _audit: { traceId, durationMs: `${durationMs}ms`, estimatedTokensSaved },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const baseUrl = config.baseUrl || 'http://localhost:8080';
  let targetUrl = `${baseUrl.replace(/\/$/, '')}${tool.path}`;

  const queryParams: Record<string, any> = {};
  let headers: Record<string, string> = {
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

  // Feature: Automatic BI-SNAP Cryptographic Signing
  if (config.biSnap?.enabled) {
    const snapHeaders = signBiSnapRequest(tool.method, tool.path, bodyData, config.biSnap);
    headers = { ...headers, ...snapHeaders };
  }

  try {
    const response = await axios({
      method: tool.method,
      url: targetUrl,
      params: queryParams,
      headers,
      data: Object.keys(bodyData).length > 0 ? bodyData : undefined,
      validateStatus: () => true, // Capture all HTTP codes without throwing
      timeout: 10000,
    });

    const durationMs = Date.now() - startTime;
    const isSuccess = response.status >= 200 && response.status < 300;

    logAuditEvent({
      traceId,
      timestamp: new Date().toISOString(),
      tool: tool.name,
      method: tool.method,
      path: tool.path,
      durationMs,
      status: isSuccess ? 'SUCCESS' : 'ERROR',
      statusCode: response.status,
      mock: false,
    }, config);

    // FinOps response trimming
    const { data: optimizedData, estimatedTokensSaved } = trimPayload(
      response.data,
      config.maxArrayItems || 10
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: response.status,
              statusText: response.statusText,
              data: optimizedData,
              _audit: {
                traceId,
                durationMs: `${durationMs}ms`,
                estimatedTokensSaved,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    logAuditEvent({
      traceId,
      timestamp: new Date().toISOString(),
      tool: tool.name,
      method: tool.method,
      path: tool.path,
      durationMs,
      status: 'ERROR',
      errorMessage: error.message,
      mock: false,
    }, config);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: true,
              message: error.message || 'Failed to dispatch request to upstream API',
              url: targetUrl,
              traceId,
              durationMs: `${durationMs}ms`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

function logAuditEvent(event: AuditLogEvent, config: GatewayConfig) {
  if (config.auditLog !== false) {
    const icon = event.status === 'SUCCESS' ? '🟢' : '🔴';
    console.log(
      `${icon} [AUDIT] [${event.traceId.slice(0, 8)}] ${event.method} ${event.path} -> ${event.status} (${event.durationMs}ms, HTTP ${event.statusCode || 'N/A'}${event.mock ? ', MOCK' : ''})`
    );
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
    return [
      buildMockFromSchema(schema.items || {}),
      buildMockFromSchema(schema.items || {}),
    ];
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return schema.default !== undefined ? schema.default : 1000000;
  }

  if (schema.type === 'boolean') {
    return true;
  }

  return schema.default || `${schema.description || 'mock_value'}`;
}
