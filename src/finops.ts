export interface TrimResult {
  data: any;
  originalSize: number;
  trimmedSize: number;
  estimatedTokensSaved: number;
}

export function trimPayload(data: any, maxArrayItems = 10): TrimResult {
  const originalJson = JSON.stringify(data);
  const originalSize = originalJson.length;

  function walk(node: any): any {
    if (!node || typeof node !== 'object') return node;

    if (Array.isArray(node)) {
      if (node.length > maxArrayItems) {
        const sliced = node.slice(0, maxArrayItems).map(walk);
        return {
          _truncated: true,
          _totalRecords: node.length,
          _displayedRecords: maxArrayItems,
          _notice: `Array trimmed by OpenAPI-MCP FinOps to optimize LLM context window. Showing ${maxArrayItems} of ${node.length} items.`,
          items: sliced,
        };
      }
      return node.map(walk);
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(node)) {
      if (val === null || val === undefined) continue; // Strip nulls to save tokens
      cleanObj[key] = walk(val);
    }
    return cleanObj;
  }

  const trimmed = walk(data);
  const trimmedJson = JSON.stringify(trimmed);
  const trimmedSize = trimmedJson.length;
  const charsSaved = Math.max(0, originalSize - trimmedSize);
  const estimatedTokensSaved = Math.round(charsSaved / 4);

  return {
    data: trimmed,
    originalSize,
    trimmedSize,
    estimatedTokensSaved,
  };
}
