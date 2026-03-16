const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readOutputs(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return Object.fromEntries(
    raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function runAction({ artifactContents, failOnMismatch, receiptId }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustsignal-action-'));
  const artifactPath = path.join(tempDir, 'artifact.txt');
  const outputPath = path.join(tempDir, 'github-output.txt');
  fs.writeFileSync(artifactPath, artifactContents, 'utf8');

  const result = spawnSync(
    process.execPath,
    ['-r', './scripts/mock-fetch.js', 'dist/index.js'],
    {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        INPUT_API_BASE_URL: 'https://api.trustsignal.dev',
        INPUT_API_KEY: 'test-key',
        INPUT_ARTIFACT_PATH: artifactPath,
        INPUT_SOURCE: 'local-test',
        INPUT_FAIL_ON_MISMATCH: String(failOnMismatch),
        GITHUB_OUTPUT: outputPath,
        GITHUB_RUN_ID: '12345',
        GITHUB_REPOSITORY: 'trustsignal-dev/trustsignal-verify-artifact',
        GITHUB_WORKFLOW: 'Artifact Verification',
        GITHUB_ACTOR: 'octocat',
        GITHUB_SHA: 'abc123def456',
        MOCK_RECEIPT_ID: receiptId
      },
      encoding: 'utf8'
    }
  );

  const outputs = fs.existsSync(outputPath) ? readOutputs(outputPath) : {};
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    outputs
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const validRun = runAction({
    artifactContents: 'valid artifact',
    failOnMismatch: true,
    receiptId: '00000000-0000-4000-8000-000000000001'
  });

  const tamperedRun = runAction({
    artifactContents: 'tampered artifact',
    failOnMismatch: false,
    receiptId: '00000000-0000-4000-8000-000000000002'
  });

  const failingMismatchRun = runAction({
    artifactContents: 'tampered artifact',
    failOnMismatch: true,
    receiptId: '00000000-0000-4000-8000-000000000003'
  });

  assert(validRun.status === 0, `Expected valid run to succeed, got ${validRun.status}: ${validRun.stderr}`);
  assert(validRun.outputs.verification_id === 'verify-00000000-0000-4000-8000-000000000001', 'Valid run verification_id mismatch');
  assert(validRun.outputs.receipt_id === '00000000-0000-4000-8000-000000000001', 'Valid run receipt_id mismatch');
  assert(validRun.outputs.status === 'verified', `Expected valid status to be verified, got ${validRun.outputs.status}`);
  assert(validRun.outputs.receipt_signature === 'sig-00000000-0000-4000-8000-000000000001', 'Valid run receipt_signature mismatch');

  assert(tamperedRun.status === 0, `Expected tampered run to complete when fail_on_mismatch=false, got ${tamperedRun.status}: ${tamperedRun.stderr}`);
  assert(tamperedRun.outputs.verification_id === 'verify-00000000-0000-4000-8000-000000000002', 'Tampered run verification_id mismatch');
  assert(tamperedRun.outputs.receipt_id === '00000000-0000-4000-8000-000000000002', 'Tampered run receipt_id mismatch');
  assert(tamperedRun.outputs.status === 'invalid', `Expected tampered status to be invalid, got ${tamperedRun.outputs.status}`);
  assert(tamperedRun.outputs.receipt_signature === 'sig-00000000-0000-4000-8000-000000000002', 'Tampered run receipt_signature mismatch');
  assert(failingMismatchRun.status !== 0, 'Expected mismatch run to fail when fail_on_mismatch=true');

  process.stdout.write('Local action contract test passed\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
