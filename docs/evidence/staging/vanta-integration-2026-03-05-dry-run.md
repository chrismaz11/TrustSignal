# Vanta Integration Evidence Capture

- Captured at (UTC): 2026-03-05T17:13:16Z
- Base URL: https://trustsignal.dev
- Schema version target: trustsignal.vanta.verification_result.v1

## Call Results
- GET /api/v1/synthetic: 404
- POST /api/v1/verify: not-run
- GET /api/v1/integrations/vanta/schema: 404
- GET /api/v1/integrations/vanta/verification/:receiptId: not-run
- receiptId observed: none

## Validation
- Result: failed
- Details: Could not validate because one or more prerequisite endpoint calls failed.

## Response Excerpts
### GET /api/v1/synthetic
```
<!DOCTYPE html><!--_UMv43HmGEFJ108oo6h7Q--><html lang="en" class="dark bg-background"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/chunks/5822932826cd6997.css" data-precedence="next"/><link rel="stylesheet" href="/_next/static/chunks/ccd88a72bdc13086.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/0ec6f20647fde433.js"/><script src="/_next/static/chunks/fe9221c50074abf1.js" async=""></script><script src="/_next/static/chunks/39e39a570d8220c3.js" async=""></script><script src="/_next/static/chunks/3112ba4734a92ea4.js" async=""></script><script src="/_next/static/chunks/turbopack-5c8a95548d52f59f.js" async=""></script><script src="/_next/static/chunks/ea94562dbfa4727e.js" async=""></script><script src="/_next/static/chunks/4718f77fa8d11c69.js" async=""></script><script src="/_next/static/chunks/8613196687bf8f82.js" async=""></script><meta name="robots" content="noindex"/><meta name="next-size-adjust" content=""/><title>404: This page could not be found.</title><title>TrustSignal — Zero-Knowledge Verification Engine</title><meta name="description" content="Open-source ZK verification for high-stakes documents. Halo2 circuits, ZKML fraud detection, and EVM-anchored proofs."/><meta name="generator" content="v0.app"/><link rel="i
```
### POST /api/v1/verify
```

```
### GET /api/v1/integrations/vanta/schema
```
<!DOCTYPE html><!--_UMv43HmGEFJ108oo6h7Q--><html lang="en" class="dark bg-background"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/chunks/5822932826cd6997.css" data-precedence="next"/><link rel="stylesheet" href="/_next/static/chunks/ccd88a72bdc13086.css" data-precedence="next"/><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/0ec6f20647fde433.js"/><script src="/_next/static/chunks/fe9221c50074abf1.js" async=""></script><script src="/_next/static/chunks/39e39a570d8220c3.js" async=""></script><script src="/_next/static/chunks/3112ba4734a92ea4.js" async=""></script><script src="/_next/static/chunks/turbopack-5c8a95548d52f59f.js" async=""></script><script src="/_next/static/chunks/ea94562dbfa4727e.js" async=""></script><script src="/_next/static/chunks/4718f77fa8d11c69.js" async=""></script><script src="/_next/static/chunks/8613196687bf8f82.js" async=""></script><meta name="robots" content="noindex"/><meta name="next-size-adjust" content=""/><title>404: This page could not be found.</title><title>TrustSignal — Zero-Knowledge Verification Engine</title><meta name="description" content="Open-source ZK verification for high-stakes documents. Halo2 circuits, ZKML fraud detection, and EVM-anchored proofs."/><meta name="generator" content="v0.app"/><link rel="i
```
### GET /api/v1/integrations/vanta/verification/:receiptId
```

```

## Manual Attachments Required
- Screenshot of Vanta workflow ingesting the payload
- Timestamped run command and operator identity
- Environment marker (staging or production)
