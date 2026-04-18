# TrustSignal SDK

**Status: `official` `v0.2.0`**

Lightweight JavaScript SDK for the TrustSignal verification API. Published as `@trustsignal/sdk`.

---

## Install

```bash
npm install @trustsignal/sdk
```

## Quickstart

```ts
import { TrustSignalSDK } from '@trustsignal/sdk';

const client = new TrustSignalSDK({
  baseUrl: 'https://api.trustsignal.dev',
  apiKey: process.env.TRUSTSIGNAL_API_KEY ?? ''
});
```

## Verify a Document

```ts
const result = await client.verify({
  doc: { pdfBase64: '<base64>' },
  ron: { commissionState: 'IL' },
  policy: { profile: 'standard' }
});

console.log(result.receiptId, result.decision, result.status);
```

## Fetch a Receipt

```ts
const receipt = await client.receipt(result.receiptId);
console.log(receipt.status, receipt.fraudRisk.band);
```

## Verify a Stored Receipt

```ts
const check = await client.verifyReceipt(result.receiptId);
console.log(check.verified, check.signatureVerified);
```

## Revoke a Receipt

Revocation requires an authorized issuer signature passed as headers — no request body is accepted.

```ts
const revoked = await client.revoke(result.receiptId, {
  issuerId: 'issuer-abc',
  signature: '<eth-signed-message>',
  timestamp: Date.now().toString()
});

console.log(revoked.result); // 'REVOKED' | 'ALREADY_REVOKED'
```

See `security.ts:verifyRevocationHeaders` in `apps/api` for the signing protocol.

---

## API Reference

| Method | Route | Scope |
|---|---|---|
| `verify(input)` | `POST /api/v1/verify` | `verify` |
| `receipt(receiptId)` | `GET /api/v1/receipt/:receiptId` | `read` |
| `verifyReceipt(receiptId)` | `POST /api/v1/receipt/:receiptId/verify` | `read` |
| `revoke(receiptId, headers)` | `POST /api/v1/receipt/:receiptId/revoke` | `revoke` |
