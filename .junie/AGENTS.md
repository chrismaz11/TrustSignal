# TrustSignal AI Engineering Guide

This document provides essential information for advanced developers and AI agents working on the TrustSignal project.

## 1. Build and Configuration

TrustSignal is a monorepo managed with NPM Workspaces.

### Prerequisites
- **Node.js**: `>=20.18.0 <21`
- **SQLite3**: For local database development.

### Setup Instructions
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Build Packages**:
   ```bash
   npm run build
   ```
3. **Initialize Database**:
   ```bash
   npm run init:db
   ```
   *Note: This creates an `attestations.sqlite` file in the root.*
4. **Generate Keys**:
   ```bash
   npm run gen:keys
   ```

### Environment Variables
Key environment variables used in the project:
- `TRUSTSIGNAL_JWT_SECRET`: Secret for signing and verifying JWTs.
- `DB_PATH`: Path to the SQLite database (defaults to `attestations.sqlite`).

## 2. Testing

The project uses `vitest` for unit, integration, and e2e testing.

### Configuration
Vitest is configured at the root in `vitest.config.ts`. Workspace-specific tests can also be run.

### Running Tests
- **Run all tests**:
  ```bash
  npm test
  ```
- **Run a specific test file**:
  ```bash
  npx vitest run path/to/test.test.ts
  ```

### Adding New Tests
New tests should be placed in the `tests/` directory, following the existing structure:
- `tests/api/`: API route tests.
- `tests/integration/`: Integration tests.
- `tests/e2e/`: End-to-end tests.

#### Example Test
Create a file named `tests/simple.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanity Check', () => {
  it('should verify basic math', () => {
    expect(1 + 1).toBe(2);
  });
});
```
Run it with: `npx vitest run tests/simple.test.ts`

## 3. Additional Development Information

### Code Style
- **TypeScript**: The project is strictly typed. Avoid `any` where possible.
- **Linting**: Run `npm run lint` to check for style violations.
- **Formatting**: Prettier is used for code formatting.

### Security Guardrails
- **No Hardcoded Secrets**: Always use environment variables.
- **PII Protection**: Do not log raw PII or sensitive data.
- **Audit Logging**: Preserve structured logs for security events.

### Project Structure
- `apps/api`: Canonical backend/API source.
- `packages/core`: Shared core logic and types.
- `packages/contracts`: Smart contracts for decentralized verification.
- `scripts/`: Utility scripts for maintenance and evidence collection.
