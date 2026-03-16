const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

global.fetch = async function mockFetch(url, options = {}) {
  const parsedUrl = new URL(url);
  const apiKey = options.headers && (options.headers['x-api-key'] || options.headers['X-API-Key']);
  if (apiKey !== 'test-key') {
    return jsonResponse(403, { error: 'Forbidden: invalid API key' });
  }

  if (parsedUrl.pathname === '/api/v1/verify' && options.method === 'POST') {
    const payload = JSON.parse(options.body || '{}');
    const receiptId = process.env.MOCK_RECEIPT_ID || '00000000-0000-4000-8000-000000000001';
    const verificationId = process.env.MOCK_VERIFICATION_ID || `verify-${receiptId}`;
    const validHash = process.env.MOCK_VALID_ARTIFACT_HASH || sha256('valid artifact');
    const isValid =
      payload?.artifact?.hash === validHash &&
      payload?.artifact?.algorithm === 'sha256' &&
      payload?.source?.provider === 'local-test' &&
      payload?.source?.repository === 'trustsignal-dev/trustsignal-verify-artifact' &&
      payload?.source?.workflow === 'Artifact Verification' &&
      payload?.source?.runId === '12345' &&
      payload?.source?.actor === 'octocat' &&
      payload?.source?.commit === 'abc123def456' &&
      typeof payload?.metadata?.artifactPath === 'string';

    return jsonResponse(200, {
      verification_id: verificationId,
      status: isValid ? 'verified' : 'invalid',
      receipt_id: receiptId,
      receipt_signature: `sig-${receiptId}`,
      valid: isValid
    });
  }

  return jsonResponse(404, { error: 'not_found' });
};
