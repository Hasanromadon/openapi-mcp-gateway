import crypto from 'node:crypto';
import { BiSnapSecurityConfig } from '../types.js';

export function signBiSnapRequest(
  method: string,
  endpointPath: string,
  bodyData: any,
  config: BiSnapSecurityConfig
): Record<string, string> {
  if (!config.clientSecret) {
    throw new Error('BI-SNAP signing requires BISNAP_SECRET (client secret).');
  }
  if (!config.partnerId) {
    throw new Error('BI-SNAP signing requires BISNAP_PARTNER_ID.');
  }
  if (!config.channelId) {
    throw new Error('BI-SNAP signing requires BISNAP_CHANNEL_ID.');
  }

  const timestamp = new Date().toISOString();
  const partnerId = config.partnerId;
  const clientSecret = config.clientSecret;
  const externalId = Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const channelId = config.channelId;

  // 1. Minify & SHA-256 hash the body (lowercase hex)
  let bodyHash = '';
  if (bodyData && Object.keys(bodyData).length > 0) {
    const minifiedBody = JSON.stringify(bodyData);
    bodyHash = crypto.createHash('sha256').update(minifiedBody).digest('hex').toLowerCase();
  } else {
    // Empty body hash per SNAP standard
    bodyHash = crypto.createHash('sha256').update('').digest('hex').toLowerCase();
  }

  // 2. Build StringToSign: Method + ":" + Path + ":" + LowercaseHex(Sha256(Body)) + ":" + Timestamp
  const stringToSign = `${method.toUpperCase()}:${endpointPath}:${bodyHash}:${timestamp}`;

  // 3. Calculate HMAC-SHA512 and encode as Base64
  const signature = crypto
    .createHmac('sha512', clientSecret)
    .update(stringToSign)
    .digest('base64');

  return {
    'X-TIMESTAMP': timestamp,
    'X-PARTNER-ID': partnerId,
    'X-EXTERNAL-ID': externalId,
    'CHANNEL-ID': channelId,
    'X-SIGNATURE': signature,
  };
}
