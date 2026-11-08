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
  const usedNames = new Set<string>();

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
      const declaredAnnotations = operation['x-mcp-annotations'] || {};
      const readOnlyHint = typeof declaredAnnotations.readOnlyHint === 'boolean'
        ? declaredAnnotations.readOnlyHint
        : method === 'get';
      const annotations = {
        readOnlyHint,
        destructiveHint: typeof declaredAnnotations.destructiveHint === 'boolean'
          ? declaredAnnotations.destructiveHint
          : !readOnlyHint && ['post', 'put', 'patch', 'delete'].includes(method),
        idempotentHint: typeof declaredAnnotations.idempotentHint === 'boolean'
          ? declaredAnnotations.idempotentHint
          : ['get', 'put', 'delete'].includes(method),
        openWorldHint: typeof declaredAnnotations.openWorldHint === 'boolean'
          ? declaredAnnotations.openWorldHint
          : true,
      };

      // Generate a descriptive, clean tool name
      const nameCandidate = operation.operationId || `${method}_${rawPath.replace(/[\/{}]/g, '_')}`;
      const baseName = sanitizeToolName(nameCandidate);
      let name = baseName;
      let suffix = 2;
      while (usedNames.has(name)) name = `${baseName.slice(0, 58)}_${suffix++}`;
      usedNames.add(name);

      const description = [
        operation.summary || `${method.toUpperCase()} ${rawPath}`,
        operation.description ? `\n\n${operation.description}` : '',
        tags.length > 0 ? `\n\n[Tags: ${tags.join(', ')}]` : '',
        `\n\n[Endpoint: ${method.toUpperCase()} ${rawPath}]`,
        annotations.readOnlyHint
          ? '\n\nReads data from the upstream API; use when this information is needed.'
          : annotations.destructiveHint
            ? '\n\nSends a request to the upstream API and may change or remove remote data. Call only when the user has requested this operation; verify important inputs before calling.'
            : '\n\nSends an additive request to the upstream API. Call only when the user has requested this operation and verify important inputs before calling.',
      ]
        .join('')
        .trim();

      // Build JSON Schema for MCP input
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const param of allParams) {
        properties[param.name] = {
          ...param.schema,
          type: param.schema?.type || 'string',
          description: param.description || `Parameter in ${param.in}`,
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
          const bodyPropertyNames = new Map<string, string>();
          for (const [propName, propSchema] of Object.entries(requestBodySchema.properties)) {
            const finalPropName = properties[propName] ? `body_${propName}` : propName;
            properties[finalPropName] = propSchema;
            bodyPropertyNames.set(propName, finalPropName);
          }

          if (Array.isArray(requestBodySchema.required)) {
            for (const reqProp of requestBodySchema.required) {
              const finalReqName = bodyPropertyNames.get(reqProp) || reqProp;
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
        annotations,
        parameters: allParams,
        requestBodySchema,
        inputSchema: {
          type: 'object',
          properties,
          additionalProperties: false,
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
