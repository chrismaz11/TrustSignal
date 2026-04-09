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

The repository includes a JavaScript SDK published as `@trustsignal/sdk`.

## Current Scope

The current SDK targets the `/v1/*` JWT-authenticated API surface:

- `POST /v1/verify-bundle`
- `POST /v1/revoke`
- `GET /v1/status/:bundleId`

For the `/api/v1/*` integration surface, use a standard HTTP client today.

The constructor option is named `apiKey`, but the SDK sends that value as a Bearer token to the `/v1/*` routes.

## Install

```bash
npm install @trustsignal/sdk
```

## Initialize the Client

```ts
import { TrustSignalSDK } from '@trustsignal/sdk';

const client = new TrustSignalSDK({
  baseUrl: 'https://api.trustsignal.example',
  apiKey: process.env.TRUSTSIGNAL_API_KEY ?? ''
});
```

## Verify a Bundle

```ts
const result = await client.verify({
  deed_hash: '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0',
  text_length: 4821,
  num_signatures: 3,
  notary_present: true,
  days_since_notarized: 11,
  amount: 425000
});
```

## Revoke a Bundle

```ts
const revoked = await client.revoke(
  '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0',
  'Court order'
);
```

## Check Status

```ts
const status = await client.status(
  '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0'
);
```

## Calling `/api/v1/*` Directly

For receipt-oriented integrations, direct HTTP is currently the clearest option:

```ts
const response = await fetch('https://api.trustsignal.example/api/v1/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.TRUSTSIGNAL_API_KEY ?? ''
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  throw new Error(`TrustSignal verify failed: ${response.status}`);
}

const data = await response.json();
```

## Integration Guidance

- Use the SDK when you already depend on the `/v1/*` bundle contract.
- Use direct HTTP for the `/api/v1/*` receipt lifecycle and Vanta-oriented flows.
- Store identifiers returned by TrustSignal so you can retrieve and re-check receipts later.
