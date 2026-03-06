#!/usr/bin/env node

import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 8787);
const secret = process.env.WEBHOOK_SECRET || 'demo-webhook-secret';

function computeSignature(timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhooks/trustsignal') {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const timestamp = req.headers['x-trustsignal-timestamp'];
    const signature = (req.headers['x-trustsignal-signature'] || '').toString();

    const expected = `sha256=${computeSignature(timestamp, rawBody)}`;
    const valid = signature === expected;

    console.log('\n--- webhook received ---');
    console.log('timestamp:', timestamp);
    console.log('signature valid:', valid);
    try {
      console.log(JSON.stringify(JSON.parse(rawBody), null, 2));
    } catch {
      console.log(rawBody);
    }

    res.statusCode = valid ? 200 : 401;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: valid }));
  });
});

server.listen(port, () => {
  console.log(`Mock Vanta webhook listener running on http://localhost:${port}/webhooks/trustsignal`);
});
