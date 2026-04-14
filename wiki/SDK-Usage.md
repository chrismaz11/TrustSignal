**Navigation**

- [Home](Home.md)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# SDK Usage

The repository includes a JavaScript SDK published as `@trustsignal/sdk`. The SDK covers the full `/api/v1/*` receipt lifecycle.

## Install

```bash
npm install @trustsignal/sdk
```

## Initialize the Client

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

Revocation requires an authorized issuer signature in headers — no request body is accepted by the endpoint.

```ts
const revoked = await client.revoke(result.receiptId, {
  issuerId: 'issuer-abc',
  signature: '<eth-signed-message>',
  timestamp: Date.now().toString()
});

console.log(revoked.result); // 'REVOKED' | 'ALREADY_REVOKED'
```

See `apps/api/src/security.ts` (`verifyRevocationHeaders`) for the signing protocol.

## API Reference

| Method | Route | Scope required |
|---|---|---|
| `verify(input)` | `POST /api/v1/verify` | `verify` |
| `receipt(receiptId)` | `GET /api/v1/receipt/:receiptId` | `read` |
| `verifyReceipt(receiptId)` | `POST /api/v1/receipt/:receiptId/verify` | `read` |
| `revoke(receiptId, headers)` | `POST /api/v1/receipt/:receiptId/revoke` | `revoke` |

## Integration Guidance

- Store the `receiptId` returned by `verify()` so you can retrieve and re-check receipts later.
- For Vanta-oriented evidence flows, use `GET /api/v1/integrations/vanta/verification/:receiptId` directly via HTTP — that endpoint is not yet covered by the SDK.
