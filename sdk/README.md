# TrustSignal SDK

Lightweight JavaScript SDK for TrustSignal verification APIs.

## Install

```bash
npm install @trustsignal/sdk
```

## Quickstart

```ts
import { TrustSignalSDK } from '@trustsignal/sdk';

const client = new TrustSignalSDK({
  baseUrl: 'https://api.trustsignal.example',
  apiKey: process.env.TRUSTSIGNAL_API_KEY ?? ''
});
```

## Verify Bundle

```ts
const result = await client.verify({
  deed_hash: '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0',
  text_length: 4821,
  num_signatures: 3,
  notary_present: true,
  days_since_notarized: 11,
  amount: 425000
});

console.log(result);
```

## Revoke Bundle (Admin JWT Required)

```ts
const revoked = await client.revoke(
  '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0',
  'Court order'
);

console.log(revoked.tx_hash, revoked.timestamp);
```

## Check Verification Status

```ts
const status = await client.status(
  '0x9ccf90f7b62f3ca69f1df442f9e44b6f95ad3f57f5f1d4dce5f35f7915d644a0'
);

console.log(status);
```
