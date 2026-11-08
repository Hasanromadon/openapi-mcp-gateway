import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOpenAPISpec } from '../src/parser.js';
import { convertOpenApiToMcpTools } from '../src/converter.js';

test('OpenAPI Converter - Converts BI-SNAP YAML to MCP Tools', async () => {
  const spec = await loadOpenAPISpec('samples/bi-snap-banking.yaml');
  assert.equal(spec.info.title, 'Bank Indonesia Fast & Open API (BI-SNAP)');

  const tools = convertOpenApiToMcpTools(spec);
  assert.equal(tools.length, 3);

  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes('getAccountBalance'));
  assert.ok(toolNames.includes('transferInterbankFunds'));
  assert.ok(toolNames.includes('getAccountStatement'));
});

test('OpenAPI Converter - Filters tools by Tag', async () => {
  const spec = await loadOpenAPISpec('samples/bi-snap-banking.yaml');
  const filtered = convertOpenApiToMcpTools(spec, {
    specPathOrUrl: 'samples/bi-snap-banking.yaml',
    includeTags: ['payments'],
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'transferInterbankFunds');
});
