import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import axios from 'axios';
import { OpenAPISpec } from './types.js';

export async function loadOpenAPISpec(specPathOrUrl: string): Promise<OpenAPISpec> {
  let content = '';

  if (specPathOrUrl.startsWith('http://') || specPathOrUrl.startsWith('https://')) {
    const response = await axios.get(specPathOrUrl, { responseType: 'text' });
    content = response.data;
  } else {
    const resolvedPath = path.resolve(process.cwd(), specPathOrUrl);
    content = await fs.readFile(resolvedPath, 'utf-8');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = yaml.load(content);
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.paths) {
    throw new Error('Invalid OpenAPI specification: missing paths definition');
  }

  return resolveInternalRefs(parsed) as OpenAPISpec;
}

/**
 * Basic internal reference resolver for #/components/schemas/...
 */
export function resolveInternalRefs(root: any): any {
  const cache = new Map<string, any>();

  function getRef(ref: string): any {
    if (cache.has(ref)) return cache.get(ref);
    if (!ref.startsWith('#/')) return { type: 'object' }; // fallback

    const parts = ref.substring(2).split('/');
    let current = root;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return { type: 'object' };
      current = current[part];
    }
    cache.set(ref, current);
    return current;
  }

  function walk(node: any, depth = 0): any {
    if (depth > 20 || !node || typeof node !== 'object') return node;

    if (Array.isArray(node)) {
      return node.map((item) => walk(item, depth + 1));
    }

    if (node.$ref && typeof node.$ref === 'string') {
      const resolved = getRef(node.$ref);
      const { $ref, ...rest } = node;
      return { ...walk(resolved, depth + 1), ...walk(rest, depth + 1) };
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = walk(value, depth + 1);
    }
    return result;
  }

  return walk(root);
}
