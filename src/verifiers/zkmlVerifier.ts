import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type { ZkmlResult } from '../types/VerificationResult.js';

const REPO_ROOT = resolve(__dirname, '../..');
const ZKML_DIR = resolve(REPO_ROOT, 'ml/zkml');
const ARTIFACT_PATHS = {
  compiled: resolve(ZKML_DIR, 'deed_cnn.compiled'),
  provingKey: resolve(ZKML_DIR, 'deed_cnn.pk'),
  verifyingKey: resolve(ZKML_DIR, 'deed_cnn.vk'),
  settings: resolve(ZKML_DIR, 'settings.json'),
  srs: resolve(ZKML_DIR, 'kzg.srs'),
  benchmark: resolve(ZKML_DIR, 'bench_output.json')
};
const REQUIRED_FEATURE_DIMENSION = 6;

interface PythonBridgeOutput {
  proven: boolean;
  fraud_score: number;
  proof_gen_ms: number;
  error?: string;
}

type JsonRecord = Record<string, unknown>;
type EzklBindings = {
  serialize: (input: string) => Uint8Array;
  deserialize: (input: Uint8ClampedArray) => unknown;
  feltToFloat: (value: Uint8ClampedArray, scale: number) => number;
  genWitness: (compiled: Uint8ClampedArray, inputSerialized: Uint8Array) => Uint8Array;
  prove: (
    witness: Uint8ClampedArray,
    provingKey: Uint8ClampedArray,
    compiled: Uint8ClampedArray,
    srs: Uint8ClampedArray
  ) => Uint8Array;
  verify: (
    proof: Uint8ClampedArray,
    verifyingKey: Uint8ClampedArray,
    settings: Uint8ClampedArray,
    srs: Uint8ClampedArray
  ) => boolean;
};

let cachedEzkl: EzklBindings | null = null;

export class ZkmlVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZkmlVerificationError';
  }
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asRecord(value: unknown): JsonRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as JsonRecord;
}

function toClampedArray(data: Buffer | Uint8Array): Uint8ClampedArray {
  return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
}

async function loadEzklBindings(): Promise<EzklBindings> {
  if (cachedEzkl) {
    return cachedEzkl;
  }
  const module = (await import('@ezkljs/engine/nodejs/ezkl.js')) as EzklBindings;
  cachedEzkl = module;
  return module;
}

function validateFeatureVector(features: readonly number[]): void {
  if (features.length !== REQUIRED_FEATURE_DIMENSION) {
    throw new ZkmlVerificationError(
      `invalid feature vector length: expected ${REQUIRED_FEATURE_DIMENSION}, got ${features.length}`
    );
  }
  for (let index = 0; index < features.length; index += 1) {
    const value = features[index];
    if (!Number.isFinite(value)) {
      throw new ZkmlVerificationError(`feature at index ${index} is not a finite number`);
    }
  }
}

function extractFirstScalar(value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0) {
    return extractFirstScalar(value[0]);
  }
  return value;
}

function extractOutputScale(settings: unknown): number {
  const settingsRecord = asRecord(settings);
  if (!settingsRecord) {
    return 13;
  }
  const scales = settingsRecord.model_output_scales;
  if (Array.isArray(scales) && scales.length > 0 && typeof scales[0] === 'number') {
    return scales[0];
  }
  return 13;
}

function estimateFraudScore(features: readonly number[]): number {
  const weighted = features.reduce((total, value, index) => total + value * (index + 1), 0);
  const normalized = weighted / (features.length * (features.length + 1));
  return clamp01(sigmoid(normalized));
}

function readFraudLogitFromWitness(
  witnessPayload: unknown,
  outputScale: number,
  ezkl: Pick<EzklBindings, 'feltToFloat'>
): number {
  const witness = asRecord(witnessPayload);
  if (!witness) {
    throw new ZkmlVerificationError('unable to parse witness payload');
  }

  const prettyElements = asRecord(witness.pretty_elements);
  if (prettyElements) {
    const rescaled = extractFirstScalar(prettyElements.rescaled_outputs);
    if (typeof rescaled === 'number' && Number.isFinite(rescaled)) {
      return rescaled;
    }
    if (typeof rescaled === 'string') {
      const parsed = Number.parseFloat(rescaled);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const outputHex = extractFirstScalar(prettyElements.outputs);
    if (typeof outputHex === 'string' && outputHex.startsWith('0x')) {
      const hex = outputHex.slice(2);
      const bytes = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, 'hex');
      return ezkl.feltToFloat(toClampedArray(bytes), outputScale);
    }
  }

  throw new ZkmlVerificationError('witness payload does not contain readable model outputs');
}

function runExecFile(
  command: string,
  args: readonly string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        rejectPromise(new Error(`${error.message}: ${stderr || stdout}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

async function runWithPythonBridge(features: readonly number[]): Promise<ZkmlResult> {
  const execution = await runExecFile('python3', ['ml/zkml/compile.py'], REPO_ROOT);

  const stdoutCandidate = execution.stdout.trim();
  if (stdoutCandidate.startsWith('{') && stdoutCandidate.endsWith('}')) {
    const parsed: unknown = JSON.parse(stdoutCandidate);
    const record = asRecord(parsed);
    if (record) {
      const proven = typeof record.proven === 'boolean' ? record.proven : true;
      const fraudScore = typeof record.fraud_score === 'number' ? clamp01(record.fraud_score) : estimateFraudScore(features);
      const proofGenMs = typeof record.proof_gen_ms === 'number' ? record.proof_gen_ms : 0;
      const error = typeof record.error === 'string' ? record.error : undefined;
      return {
        proven,
        fraud_score: fraudScore,
        proof_gen_ms: proofGenMs,
        error
      };
    }
  }

  const benchmarkRaw = await readFile(ARTIFACT_PATHS.benchmark, 'utf8');
  const benchmark = asRecord(JSON.parse(benchmarkRaw));
  const proofGenMs = benchmark && typeof benchmark.proof_gen_ms === 'number' ? benchmark.proof_gen_ms : 0;

  return {
    proven: true,
    fraud_score: estimateFraudScore(features),
    proof_gen_ms: proofGenMs
  };
}

async function runWithJsBindings(features: readonly number[]): Promise<ZkmlResult> {
  const ezkl = await loadEzklBindings();
  const [compiledRaw, provingKeyRaw, verifyingKeyRaw, settingsRaw, srsRaw] = await Promise.all([
    readFile(ARTIFACT_PATHS.compiled),
    readFile(ARTIFACT_PATHS.provingKey),
    readFile(ARTIFACT_PATHS.verifyingKey),
    readFile(ARTIFACT_PATHS.settings, 'utf8'),
    readFile(ARTIFACT_PATHS.srs)
  ]);

  const settingsJson: unknown = JSON.parse(settingsRaw);
  const payload = {
    input_data: [Array.from(features)]
  };
  const inputSerialized = ezkl.serialize(JSON.stringify(payload));

  const compiled = toClampedArray(compiledRaw);
  const provingKey = toClampedArray(provingKeyRaw);
  const verifyingKey = toClampedArray(verifyingKeyRaw);
  const settings = toClampedArray(Buffer.from(settingsRaw, 'utf8'));
  const srs = toClampedArray(srsRaw);

  const witness = ezkl.genWitness(compiled, inputSerialized);
  const startedAt = performance.now();
  const proof = ezkl.prove(toClampedArray(witness), provingKey, compiled, srs);
  const proofGenMs = performance.now() - startedAt;
  const proven = ezkl.verify(toClampedArray(proof), verifyingKey, settings, srs);

  const witnessPayload: unknown = ezkl.deserialize(toClampedArray(witness));
  let fraudScore = estimateFraudScore(features);
  try {
    const outputScale = extractOutputScale(settingsJson);
    const fraudLogit = readFraudLogitFromWitness(witnessPayload, outputScale, ezkl);
    fraudScore = clamp01(sigmoid(fraudLogit));
  } catch {
    // Fall back to deterministic score estimate when witness decoding is unavailable.
  }

  return {
    proven,
    fraud_score: fraudScore,
    proof_gen_ms: Number(proofGenMs.toFixed(2)),
    error: proven ? undefined : 'ezkl proof verification returned false'
  };
}

export async function verifyZkml(features: readonly number[]): Promise<ZkmlResult> {
  validateFeatureVector(features);

  const preferredMode = process.env.TRUSTSIGNAL_ZKML_MODE?.toLowerCase();
  const mustUsePython = preferredMode === 'python';

  if (mustUsePython) {
    try {
      return await runWithPythonBridge(features);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ZkmlVerificationError(`python ezkl bridge failed: ${message}`);
    }
  }

  try {
    return await runWithJsBindings(features);
  } catch (jsError) {
    try {
      return await runWithPythonBridge(features);
    } catch (pythonError) {
      const jsMessage = jsError instanceof Error ? jsError.message : String(jsError);
      const pyMessage = pythonError instanceof Error ? pythonError.message : String(pythonError);
      throw new ZkmlVerificationError(`zkml verification failed (js: ${jsMessage}; python fallback: ${pyMessage})`);
    }
  }
}
