#!/usr/bin/env node

import crypto from 'node:crypto';

const baseUrl = process.env.TRUSTSIGNAL_BASE_URL || 'http://localhost:8080';
const apiKey = process.env.TRUSTSIGNAL_API_KEY;
const callbackUrl = process.env.VANTA_CALLBACK_URL;
const webhookSecret = process.env.TRUSTSIGNAL_WEBHOOK_SECRET || 'demo-webhook-secret';

if (!apiKey) {
  console.error('Missing TRUSTSIGNAL_API_KEY');
  process.exit(1);
}

const payload = {
  bundleId: `vanta-demo-${Date.now()}`,
  transactionType: 'DEED_TRANSFER',
  ron: {
    provider: 'DemoRON',
    notaryId: 'NTR-100',
    commissionState: 'IL',
    sealPayload: 'demo-seal'
  },
  doc: {
    docHash: '0x4ce3a69b2cb4854f8f4e9d89e2cb38ce4d9482d937f3418d57a6973012b6e278',
    county: 'Cook',
    state: 'IL',
    parcelId: '17-20-226-014-0000',
    grantor: 'Jane Seller',
    grantee: 'Acme Title LLC'
  },
  policy: {
    profile: 'STANDARD_IL'
  }
};

const verifyRes = await fetch(`${baseUrl}/api/v1/verify`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify(payload)
});

const verifyBody = await verifyRes.json();
if (!verifyRes.ok) {
  console.error('Verification failed:', verifyRes.status, verifyBody);
  process.exit(2);
}

const receiptId = verifyBody.receiptId;
const statusRes = await fetch(`${baseUrl}/api/v1/integrations/vanta/verification/${receiptId}`, {
  headers: {
    'x-api-key': apiKey
  }
});

const statusBody = await statusRes.json();
if (!statusRes.ok) {
  console.error('Status fetch failed:', statusRes.status, statusBody);
  process.exit(3);
}

const output = { receiptId, verify: verifyBody, vanta: statusBody };

if (callbackUrl) {
  const event = {
    eventId: `evt_${Date.now()}`,
    eventType: 'verification.completed',
    occurredAt: new Date().toISOString(),
    partner: 'trustsignal',
    schemaVersion: 'trustsignal.webhook.v1',
    data: {
      verificationId: receiptId,
      normalizedStatus: statusBody?.result?.normalizedStatus ?? 'UNKNOWN',
      decision: statusBody?.result?.decision ?? 'UNKNOWN',
      receiptId,
      receiptHash: statusBody?.subject?.receiptHash ?? verifyBody?.receiptHash
    }
  };

  const rawBody = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
  const signature = `sha256=${digest}`;

  const callbackRes = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-trustsignal-timestamp': timestamp,
      'x-trustsignal-signature': signature,
      'x-trustsignal-event-id': event.eventId
    },
    body: rawBody
  });

  output.webhook = {
    delivered: callbackRes.ok,
    status: callbackRes.status,
    callbackUrl
  };
}

console.log(JSON.stringify(output, null, 2));
