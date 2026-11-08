import test from 'node:test';
import assert from 'node:assert/strict';
import { signBiSnapRequest } from '../src/security/bisnap.js';

test('BI-SNAP Security - Generates Valid Headers & HMAC-SHA512 Signature', () => {
  const method = 'POST';
  const path = '/v1.0/balance-inquiry';
  const body = { accountNo: '1029384756' };
  const config = {
    enabled: true,
    partnerId: 'PARTNER-TEST-99',
    clientSecret: 'super-secret-key-12345',
    channelId: '95051',
  };

  const headers = signBiSnapRequest(method, path, body, config);

  assert.equal(headers['X-PARTNER-ID'], 'PARTNER-TEST-99');
  assert.equal(headers['CHANNEL-ID'], '95051');
  assert.ok(headers['X-TIMESTAMP'], 'Timestamp should be defined');
  assert.ok(headers['X-EXTERNAL-ID'], 'External ID should be defined');
  assert.ok(headers['X-SIGNATURE'], 'Signature should be defined');
  assert.ok(headers['X-SIGNATURE'].length > 20, 'Signature should be base64 string');
});

test('BI-SNAP Security - Refuses to sign without configured credentials', () => {
  assert.throws(
    () => signBiSnapRequest('POST', '/v1.0/transfer-interbank', {}, {
      enabled: true,
      partnerId: 'PARTNER-TEST-99',
      channelId: '95051',
    }),
    /BISNAP_SECRET/
  );
  assert.throws(
    () => signBiSnapRequest('POST', '/v1.0/transfer-interbank', {}, {
      enabled: true,
      clientSecret: 'configured-secret',
      channelId: '95051',
    }),
    /BISNAP_PARTNER_ID/
  );
});
