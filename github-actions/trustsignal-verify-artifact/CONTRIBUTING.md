# Contributing

## Local Validation

Run the lightweight validation checks before opening a change:

```bash
node --check src/index.js
node --check dist/index.js
node scripts/test-local.js
```

Or use package scripts:

```bash
npm run check
npm run test:local
npm run validate:local
```

## Repository Structure

- `action.yml`: GitHub Action metadata
- `src/`: source implementation
- `dist/`: committed runtime entrypoint for action consumers
- `scripts/`: local validation helpers
- `docs/`: integration-facing documentation

## Release Basics

- Follow semantic versioning.
- Commit updated `dist/index.js` with each release.
- Publish immutable tags such as `v0.1.0` and maintain a major tag such as `v1`.
- GitHub Marketplace publication requires a public repository with `action.yml` at the repository root.
