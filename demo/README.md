# TrustSignal 5-Minute Developer Trial

This demo shows the TrustSignal verification lifecycle in one local command:

artifact -> verification -> signed receipt -> later verification -> tampered artifact detection

It is intentionally local-only and requires no external services or environment variables.

## Run

```bash
git clone <trustsignal-repo-url>
cd trustsignal
npm install
npm run demo
```

## What It Does

1. Loads [`sample-artifact.json`](./sample-artifact.json)
2. Computes and prints the artifact hash
3. Generates a verification result
4. Issues a signed verification receipt
5. Persists the receipt to `demo/output/verification-receipt.json`
6. Reloads that receipt for later verification
7. Verifies that a tampered artifact no longer matches the stored receipt

## Expected Output

The command prints:

- artifact hash
- verification result
- receipt issuance
- later verification check
- tampered artifact mismatch

## Files

- [`sample-artifact.json`](./sample-artifact.json): canonical artifact used for issuance
- [`tampered-artifact.json`](./tampered-artifact.json): altered artifact used to demonstrate mismatch detection
- [`demo-script.ts`](./demo-script.ts): local verification lifecycle demo
