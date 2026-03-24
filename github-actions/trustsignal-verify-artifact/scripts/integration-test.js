// Live integration test against a deployed TrustSignal verification endpoint.
//
// Required environment variables (test is skipped when absent):
//   TRUSTSIGNAL_INTEGRATION_API_BASE_URL  — e.g. https://api.trustsignal.dev
//   TRUSTSIGNAL_INTEGRATION_API_KEY       — scoped API key with verify scope
//
// Optional:
//   TRUSTSIGNAL_INTEGRATION_ARTIFACT_PATH — path to a local artifact to hash
//                                           (defaults to a temp file created by the test)
//
// Usage:
//   node scripts/integration-test.js
//   npm run test:integration

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const apiBaseUrl = process.env.TRUSTSIGNAL_INTEGRATION_API_BASE_URL;
const apiKey = process.env.TRUSTSIGNAL_INTEGRATION_API_KEY;

if (!apiBaseUrl || !apiKey) {
  process.stdout.write(
    'Integration test skipped: TRUSTSIGNAL_INTEGRATION_API_BASE_URL and ' +
      'TRUSTSIGNAL_INTEGRATION_API_KEY are not set.\n'
  );
  process.exit(0);
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readOutputs(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  return Object.fromEntries(
    raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx), line.slice(idx + 1)];
      })
  );
}

function runAction({ artifactPath, artifactHash, failOnMismatch = true } = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustsignal-integration-'));
  const outputPath = path.join(tempDir, 'github-output.txt');

  const env = {
    ...process.env,
    INPUT_API_BASE_URL: apiBaseUrl,
    INPUT_API_KEY: apiKey,
    INPUT_SOURCE: 'integration-test',
    INPUT_FAIL_ON_MISMATCH: String(failOnMismatch),
    GITHUB_OUTPUT: outputPath,
    GITHUB_RUN_ID: 'integration-test-001',
    GITHUB_REPOSITORY: 'trustsignal-dev/trustsignal-verify-artifact',
    GITHUB_WORKFLOW: 'Integration Test',
    GITHUB_ACTOR: 'integration-test-runner',
    // Use a realistic-looking 40-character hex string for the commit SHA context field.
    GITHUB_SHA: sha256('integration-test').slice(0, 40)
  };

  if (artifactPath) {
    env.INPUT_ARTIFACT_PATH = artifactPath;
  }
  if (artifactHash) {
    env.INPUT_ARTIFACT_HASH = artifactHash;
  }

  // Run dist/index.js without any fetch mock — this is a real HTTP call.
  const result = spawnSync(process.execPath, ['dist/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env,
    encoding: 'utf8',
    timeout: 60_000
  });

  const outputs = readOutputs(outputPath);

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    outputs
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertNonEmpty(value, name) {
  assert(typeof value === 'string' && value.length > 0, `${name} must be a non-empty string`);
}

function main() {
  process.stdout.write(`Integration test running against: ${apiBaseUrl}\n`);

  // Create a unique test artifact per run to avoid stale-cache edge cases on the API side.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustsignal-artifact-'));
  const artifactContent = `trustsignal-integration-test-artifact ${Date.now()}`;
  const artifactPath = path.join(tempDir, 'artifact.txt');
  fs.writeFileSync(artifactPath, artifactContent, 'utf8');

  // ── Test 1: verify by file path ──────────────────────────────────────────
  process.stdout.write('  Test 1: verify by artifact_path ... ');
  const pathRun = runAction({ artifactPath, failOnMismatch: false });

  if (pathRun.status !== 0) {
    process.stderr.write(`FAIL (exit ${pathRun.status})\n${pathRun.stderr}\n`);
    process.exit(1);
  }

  assertNonEmpty(
    pathRun.outputs.verification_id || pathRun.outputs.receipt_id,
    'verification_id or receipt_id'
  );
  assertNonEmpty(pathRun.outputs.status, 'status');

  process.stdout.write(`OK (status=${pathRun.outputs.status})\n`);

  // ── Test 2: verify by precomputed hash ───────────────────────────────────
  process.stdout.write('  Test 2: verify by artifact_hash ... ');
  const artifactHash = sha256(artifactContent);
  const hashRun = runAction({ artifactHash, failOnMismatch: false });

  if (hashRun.status !== 0) {
    process.stderr.write(`FAIL (exit ${hashRun.status})\n${hashRun.stderr}\n`);
    process.exit(1);
  }

  assertNonEmpty(
    hashRun.outputs.verification_id || hashRun.outputs.receipt_id,
    'verification_id or receipt_id'
  );
  assertNonEmpty(hashRun.outputs.status, 'status');

  process.stdout.write(`OK (status=${hashRun.outputs.status})\n`);

  // ── Test 3: invalid API key returns failure ───────────────────────────────
  process.stdout.write('  Test 3: invalid API key is rejected ... ');
  const savedKey = process.env.TRUSTSIGNAL_INTEGRATION_API_KEY;
  // Temporarily override via the INPUT env var used by the action
  const badKeyEnv = {
    ...process.env,
    INPUT_API_BASE_URL: apiBaseUrl,
    INPUT_API_KEY: 'INVALID_KEY_FOR_TEST',
    INPUT_ARTIFACT_PATH: artifactPath,
    INPUT_SOURCE: 'integration-test',
    INPUT_FAIL_ON_MISMATCH: 'false'
  };
  const badKeyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustsignal-badkey-'));
  const badKeyOutput = path.join(badKeyDir, 'github-output.txt');
  badKeyEnv.GITHUB_OUTPUT = badKeyOutput;
  const badKeyRun = spawnSync(process.execPath, ['dist/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: badKeyEnv,
    encoding: 'utf8',
    timeout: 60_000
  });

  assert(
    badKeyRun.status !== 0 || badKeyRun.stderr.includes('::error::'),
    'expected action to fail or emit error on invalid API key'
  );
  process.stdout.write('OK\n');

  // ── Test 4: output field contract ────────────────────────────────────────
  process.stdout.write('  Test 4: output field contract ... ');
  // verification_id is set (may be same as receipt_id per compat alias)
  assert(
    typeof pathRun.outputs.verification_id === 'string',
    'verification_id output must be present'
  );
  assert(typeof pathRun.outputs.status === 'string', 'status output must be present');
  assert(typeof pathRun.outputs.receipt_id === 'string', 'receipt_id output must be present');
  assert(
    typeof pathRun.outputs.receipt_signature === 'string',
    'receipt_signature output must be present'
  );
  process.stdout.write('OK\n');

  process.stdout.write('\nAll integration tests passed.\n');
  process.stdout.write(`  verification_id: ${pathRun.outputs.verification_id}\n`);
  process.stdout.write(`  receipt_id:      ${pathRun.outputs.receipt_id}\n`);
  process.stdout.write(`  status:          ${pathRun.outputs.status}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Integration test error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
