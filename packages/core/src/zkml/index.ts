/**
 * zkml/index.ts — ezkl ZKML fraud scoring proof integration.
 *
 * Calls the ezkl CLI as an external subprocess to generate and verify
 * zero-knowledge proofs for the DeedFraudCNN model inference.
 *
 * Production prerequisites:
 *   - ezkl installed: https://github.com/zkonduit/ezkl
 *   - ZKML artifacts compiled: ml/zkml/deed_cnn.compiled, ml/zkml/deed_cnn.vk, ml/zkml/kzg.srs
 *   - TRUSTSIGNAL_ZKML_EZKL_BIN set to the ezkl binary path
 *   - TRUSTSIGNAL_ZKML_ARTIFACTS_DIR set to ml/zkml/
 *
 * In dev-only mode (no env vars set), proof generation returns a
 * simulated attestation with status: 'dev-only'.
 */

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type ZkmlFraudAttestation = {
  proofId: string;
  scheme: 'EZKL-v1' | 'EZKL-DEV-v0';
  status: 'verifiable' | 'dev-only';
  backend: 'ezkl' | 'ezkl-dev';
  modelId: 'deed-fraud-cnn-v1';
  inputDigest: string;
  outputDigest: string;
  proof?: string;        // base64-encoded ezkl proof when status=verifiable
  verificationKey?: string; // base64-encoded verification key ID
  generatedAt: string;
};

type EzklWitnessInput = {
  input_data: number[][];
};

function getEzklBin(): string | null {
  return process.env.TRUSTSIGNAL_ZKML_EZKL_BIN?.trim() || null;
}

function getArtifactsDir(): string | null {
  return process.env.TRUSTSIGNAL_ZKML_ARTIFACTS_DIR?.trim() || null;
}

function sha256Digest(data: Buffer | string): string {
  return `0x${createHash('sha256').update(data).digest('hex')}`;
}

function runEzkl(args: string[], stdinData?: string): Promise<{ stdout: string; stderr: string }> {
  const ezklBin = getEzklBin()!;
  return new Promise((resolve, reject) => {
    const child = spawn(ezklBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ezkl exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    if (stdinData) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}

/**
 * Generate a ZKML proof that the DeedFraudCNN model produced a specific fraud score
 * for the given feature vector.
 *
 * When TRUSTSIGNAL_ZKML_EZKL_BIN and TRUSTSIGNAL_ZKML_ARTIFACTS_DIR are set,
 * generates a real ezkl proof. Otherwise returns a dev-only attestation.
 */
export async function generateFraudScoreProof(
  features: number[],
  fraudScore: number
): Promise<ZkmlFraudAttestation> {
  const proofId = randomUUID();
  const generatedAt = new Date().toISOString();
  const featureBuffer = Buffer.from(JSON.stringify(features));
  const inputDigest = sha256Digest(featureBuffer);
  const outputDigest = sha256Digest(Buffer.from(String(fraudScore)));

  const ezklBin = getEzklBin();
  const artifactsDir = getArtifactsDir();

  if (!ezklBin || !artifactsDir) {
    // Dev-only mode: return simulated attestation.
    return {
      proofId,
      scheme: 'EZKL-DEV-v0',
      status: 'dev-only',
      backend: 'ezkl-dev',
      modelId: 'deed-fraud-cnn-v1',
      inputDigest,
      outputDigest,
      generatedAt
    };
  }

  // Production mode: call ezkl to generate a real proof.
  const tmpDir = mkdtempSync(join(tmpdir(), 'trustsignal-zkml-'));
  try {
    // Write witness input.
    const witnessInput: EzklWitnessInput = { input_data: [features] };
    const witnessInputPath = join(tmpDir, 'input.json');
    writeFileSync(witnessInputPath, JSON.stringify(witnessInput));

    const compiledModelPath = join(artifactsDir, 'deed_cnn.compiled');
    const srsPath = join(artifactsDir, 'kzg.srs');
    const vkPath = join(artifactsDir, 'deed_cnn.vk');
    const witnessPath = join(tmpDir, 'witness.json');
    const proofPath = join(tmpDir, 'proof.json');

    // Generate witness.
    await runEzkl([
      'gen-witness',
      '-M', compiledModelPath,
      '-D', witnessInputPath,
      '-O', witnessPath
    ]);

    // Generate proof.
    await runEzkl([
      'prove',
      '-M', compiledModelPath,
      '--witness', witnessPath,
      '--pk-path', vkPath,
      '--srs-path', srsPath,
      '--proof-path', proofPath,
      '--proof-type', 'single'
    ]);

    const proofJson = readFileSync(proofPath, 'utf8');
    const proof = Buffer.from(proofJson).toString('base64');
    const vkContent = readFileSync(vkPath);
    const verificationKeyId = sha256Digest(vkContent).slice(2, 18); // 8-byte fingerprint

    return {
      proofId,
      scheme: 'EZKL-v1',
      status: 'verifiable',
      backend: 'ezkl',
      modelId: 'deed-fraud-cnn-v1',
      inputDigest,
      outputDigest,
      proof,
      verificationKey: verificationKeyId,
      generatedAt
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Verify a ZKML fraud score proof using ezkl.
 * Returns true only for verifiable proofs when the ezkl binary is available.
 */
export async function verifyFraudScoreProof(attestation: ZkmlFraudAttestation): Promise<boolean> {
  if (attestation.status !== 'verifiable') return false;
  if (attestation.scheme !== 'EZKL-v1') return false;
  if (!attestation.proof) return false;

  const ezklBin = getEzklBin();
  const artifactsDir = getArtifactsDir();
  if (!ezklBin || !artifactsDir) return false;

  const tmpDir = mkdtempSync(join(tmpdir(), 'trustsignal-zkml-verify-'));
  try {
    const proofPath = join(tmpDir, 'proof.json');
    writeFileSync(proofPath, Buffer.from(attestation.proof, 'base64').toString('utf8'));

    const compiledModelPath = join(artifactsDir, 'deed_cnn.compiled');
    const srsPath = join(artifactsDir, 'kzg.srs');
    const vkPath = join(artifactsDir, 'deed_cnn.vk');

    await runEzkl([
      'verify',
      '--proof-path', proofPath,
      '--vk-path', vkPath,
      '--srs-path', srsPath,
      '-M', compiledModelPath
    ]);

    return true;
  } catch {
    return false;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
