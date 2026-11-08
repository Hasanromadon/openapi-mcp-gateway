import { OpenAPISpec, ParsedTool, ParsedToolParameter, GatewayConfig } from './types.js';

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

export function sanitizeToolName(raw: string): string {
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized.slice(0, 64) || 'tool';
}

function matchesPattern(str: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return str.startsWith(prefix);
  }
  return str === pattern;
}

export function convertOpenApiToMcpTools(spec: OpenAPISpec, config?: GatewayConfig): ParsedTool[] {
  const tools: ParsedTool[] = [];

  for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    // Check excludePaths filter
    if (config?.excludePaths && config.excludePaths.some((p) => matchesPattern(rawPath, p))) {
      continue;
    }

    // Check includePaths filter
    if (config?.includePaths && config.includePaths.length > 0) {
      const isIncluded = config.includePaths.some((p) => matchesPattern(rawPath, p));
      if (!isIncluded) continue;
    }

    const commonParams: ParsedToolParameter[] = Array.isArray(pathItem.parameters)
      ? pathItem.parameters.map(normalizeParameter)
      : [];

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation || typeof operation !== 'object') continue;

      const tags: string[] = Array.isArray(operation.tags) ? operation.tags : [];

      // Check includeTags filter
      if (config?.includeTags && config.includeTags.length > 0) {
        const hasTag = tags.some((t) => config.includeTags!.includes(t));
        if (!hasTag) continue;
      }

      const opParams: ParsedToolParameter[] = Array.isArray(operation.parameters)
        ? operation.parameters.map(normalizeParameter)
        : [];

      const allParams = [...commonParams, ...opParams];

      // Generate a descriptive, clean tool name
      const nameCandidate = operation.operationId || `${method}_${rawPath.replace(/[\/{}]/g, '_')}`;
      const name = sanitizeToolName(nameCandidate);

      const description = [
        operation.summary || `${method.toUpperCase()} ${rawPath}`,
        operation.description ? `\n\n${operation.description}` : '',
        tags.length > 0 ? `\n\n[Tags: ${tags.join(', ')}]` : '',
        `\n\n[Endpoint: ${method.toUpperCase()} ${rawPath}]`,
      ]
        .join('')
        .trim();

      // Build JSON Schema for MCP input
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const param of allParams) {
        properties[param.name] = {
          type: param.schema?.type || 'string',
          description: param.description || `Parameter in ${param.in}`,
          ...(param.schema?.enum ? { enum: param.schema.enum } : {}),
          ...(param.schema?.default !== undefined ? { default: param.schema.default } : {}),
        };

        if (param.required || param.in === 'path') {
          required.push(param.name);
        }
      }

      // Handle application/json request body
      let requestBodySchema: any = null;
      if (operation.requestBody?.content?.['application/json']?.schema) {
        requestBodySchema = operation.requestBody.content['application/json'].schema;

        if (requestBodySchema.type === 'object' && requestBodySchema.properties) {
          for (const [propName, propSchema] of Object.entries(requestBodySchema.properties)) {
            const finalPropName = properties[propName] ? `body_${propName}` : propName;
            properties[finalPropName] = propSchema;
          }

          if (Array.isArray(requestBodySchema.required)) {
            for (const reqProp of requestBodySchema.required) {
              const finalReqName = properties[reqProp] ? reqProp : `body_${reqProp}`;
              if (!required.includes(finalReqName)) {
                required.push(finalReqName);
              }
            }
          }
        } else {
          properties['requestBody'] = {
            type: 'object',
            description: operation.requestBody.description || 'Request JSON payload',
            ...requestBodySchema,
          };
          if (operation.requestBody.required) {
            required.push('requestBody');
          }
        }
      }

      tools.push({
        name,
        description,
        method: method.toUpperCase(),
        path: rawPath,
        tags,
        parameters: allParams,
        requestBodySchema,
        inputSchema: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
        responses: operation.responses,
      });
    }
  }

  return tools;
}

function normalizeParameter(p: any): ParsedToolParameter {
  return {
    name: p.name,
    in: p.in,
    description: p.description,
    required: !!p.required,
    schema: p.schema || { type: 'string' },
  };
}
