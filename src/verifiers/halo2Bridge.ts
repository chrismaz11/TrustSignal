import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';

type Halo2Mode = 'non-mem' | 'revocation';

export interface Halo2Request {
  mode: Halo2Mode;
  bundleHash: string;
  tampered?: boolean;
  revoked?: boolean;
}

export interface Halo2BridgeResult {
  ok: boolean;
  proofGenMs: number;
  error?: string;
}

interface Halo2VerifierJson {
  mode: string;
  ok: boolean;
  proof_gen_ms: number;
  gate_count: number;
  k: number;
  error: string | null;
}

const REPO_ROOT = resolve(__dirname, '../..');
const CIRCUIT_DIR = resolve(REPO_ROOT, 'circuits/non_mem_gadget');
const BINARY_PATH = resolve(CIRCUIT_DIR, 'target/release/verify_bundle');
let buildPromise: Promise<void> | null = null;

function runCommand(command: string, args: readonly string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      rejectPromise(error);
    });

    child.on('close', (exitCode) => {
      resolvePromise({ stdout, stderr, exitCode });
    });
  });
}

async function ensureBinary(): Promise<void> {
  try {
    await access(BINARY_PATH, fsConstants.X_OK);
    return;
  } catch {
    if (!buildPromise) {
      buildPromise = (async () => {
        const result = await runCommand('cargo', ['build', '--release', '--bin', 'verify_bundle'], CIRCUIT_DIR);
        if (result.exitCode !== 0) {
          throw new Error(`cargo build failed: ${result.stderr.trim() || result.stdout.trim()}`);
        }
      })().finally(() => {
        buildPromise = null;
      });
    }
    await buildPromise;
  }
}

function parseVerifierOutput(stdout: string): Halo2VerifierJson {
  const candidate = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
    .at(-1);

  if (!candidate) {
    throw new Error('halo2 verifier did not emit JSON output');
  }

  const parsed: unknown = JSON.parse(candidate);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('invalid halo2 verifier payload');
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.ok !== 'boolean' || typeof record.proof_gen_ms !== 'number') {
    throw new Error('halo2 verifier payload missing required fields');
  }

  return {
    mode: typeof record.mode === 'string' ? record.mode : '',
    ok: record.ok,
    proof_gen_ms: record.proof_gen_ms,
    gate_count: typeof record.gate_count === 'number' ? record.gate_count : 0,
    k: typeof record.k === 'number' ? record.k : 0,
    error: typeof record.error === 'string' ? record.error : null
  };
}

export async function runHalo2Verifier(request: Halo2Request): Promise<Halo2BridgeResult> {
  await ensureBinary();

  const args: string[] = ['--mode', request.mode, '--bundle-hash', request.bundleHash];
  if (request.mode === 'non-mem' && request.tampered) {
    args.push('--tampered');
  }
  if (request.mode === 'revocation' && request.revoked) {
    args.push('--revoked');
  }

  const result = await runCommand(BINARY_PATH, args, CIRCUIT_DIR);
  if (result.exitCode !== 0) {
    throw new Error(`halo2 verifier exited with code ${result.exitCode}: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  const parsed = parseVerifierOutput(result.stdout);
  return {
    ok: parsed.ok,
    proofGenMs: parsed.proof_gen_ms,
    error: parsed.error ?? undefined
  };
}
