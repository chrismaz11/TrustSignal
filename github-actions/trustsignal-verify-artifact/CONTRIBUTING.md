# Contributing

## Local Validation

Run the complete validation suite before opening a change:

```bash
npm run validate
```

This runs the following checks in order:

1. **`npm run check`** — Node.js syntax check for `src/index.js` and `dist/index.js`.
2. **`npm run check:dist`** — SHA-256 comparison to confirm `dist/index.js` matches `src/index.js`.
3. **`npm run test:local`** — Local action contract test using a mock fetch (no live API required).

Or run each step individually:

```bash
node --check src/index.js
node --check dist/index.js
node scripts/check-dist.js
node scripts/test-local.js
```

## Live Integration Test

To run the end-to-end integration test against a deployed TrustSignal API:

```bash
export TRUSTSIGNAL_INTEGRATION_API_BASE_URL=https://api.trustsignal.dev
export TRUSTSIGNAL_INTEGRATION_API_KEY=<your-api-key>
npm run test:integration
```

The test skips cleanly when the environment variables are not set.

## Repository Structure

- `action.yml`: GitHub Action metadata
- `src/`: source implementation
- `dist/`: committed runtime entrypoint for action consumers
- `scripts/`: local validation helpers
  - `mock-fetch.js`: fetch mock used by `test-local.js`
  - `test-local.js`: local contract test (mock-based)
  - `check-dist.js`: dist alignment check
  - `integration-test.js`: live integration test (skips without credentials)
- `docs/`: integration-facing documentation
  - `integration.md`: verification flow, request/response contract, security notes
  - `release-checklist.md`: pre-release and tagging checklist

## Building

```bash
npm run build
```

This copies `src/index.js` to `dist/index.js`. Run `npm run check:dist` afterwards to
confirm alignment.

## Release

See `docs/release-checklist.md` for the complete release process, including:

- dist alignment verification
- semantic version tagging
- the public ref policy: pin to a maintainer-published release tag or commit SHA; stable major tags are not guaranteed
- GitHub Marketplace publication steps
