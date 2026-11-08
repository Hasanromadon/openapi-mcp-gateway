import test from 'node:test';
import assert from 'node:assert/strict';
import { trimPayload } from '../src/finops.js';

test('FinOps Token Trimmer - Truncates Large Arrays and Calculates Token Savings', () => {
  const largeArray = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    transactionDate: '2026-11-09T00:00:00Z',
    amount: 1500000,
    description: `Transaction number ${i} for enterprise corporate account`,
  }));

  const inputPayload = {
    responseCode: '2001400',
    statementRecords: largeArray,
    nullField: null,
  };

  const { data, originalSize, trimmedSize, estimatedTokensSaved } = trimPayload(inputPayload, 5);

  assert.equal(data.nullField, undefined, 'Null fields should be stripped');
  assert.equal(data.statementRecords.items.length, 5, 'Should be trimmed to max items');
  assert.equal(data.statementRecords._totalRecords, 50);
  assert.ok(trimmedSize < originalSize, 'Trimmed size should be smaller than original');
  assert.ok(estimatedTokensSaved > 0, 'Estimated tokens saved should be positive');
});
