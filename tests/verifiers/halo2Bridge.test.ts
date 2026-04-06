import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  access: vi.fn()
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

import { runHalo2Verifier } from '../../src/verifiers/halo2Bridge.js';

function makeMockChild(
  stdoutData: string,
  stderrData: string,
  exitCode: number | null
): ChildProcess {
  const child = new EventEmitter() as unknown as ChildProcess;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  (child as unknown as Record<string, unknown>).stdout = stdout;
  (child as unknown as Record<string, unknown>).stderr = stderr;

  process.nextTick(() => {
    stdout.emit('data', Buffer.from(stdoutData));
    stderr.emit('data', Buffer.from(stderrData));
    child.emit('close', exitCode);
  });

  return child;
}

const validJsonOutput = JSON.stringify({
  mode: 'non-mem',
  ok: true,
  proof_gen_ms: 45.5,
  gate_count: 100,
  k: 10,
  error: null
});

describe('runHalo2Verifier', () => {
  beforeEach(() => {
    vi.mocked(access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds for non-mem mode and returns ok=true', async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(validJsonOutput + '\n', '', 0));

    const result = await runHalo2Verifier({
      mode: 'non-mem',
      bundleHash: 'bundle-001'
    });

    expect(result.ok).toBe(true);
    expect(result.proofGenMs).toBe(45.5);
    expect(result.error).toBeUndefined();
  });

  it('includes --tampered flag for non-mem mode when tampered=true', async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(validJsonOutput + '\n', '', 0));

    await runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-x', tampered: true });

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    expect(spawnCall[1]).toContain('--tampered');
  });

  it('does not include --tampered flag when tampered=false', async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(validJsonOutput + '\n', '', 0));

    await runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-x', tampered: false });

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    expect(spawnCall[1]).not.toContain('--tampered');
  });

  it('includes --revoked flag for revocation mode when revoked=true', async () => {
    const revOutput = JSON.stringify({ mode: 'revocation', ok: true, proof_gen_ms: 20, gate_count: 0, k: 0, error: null });
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(revOutput + '\n', '', 0));

    await runHalo2Verifier({ mode: 'revocation', bundleHash: 'bundle-r', revoked: true });

    const spawnCall = vi.mocked(spawn).mock.calls[0];
    expect(spawnCall[1]).toContain('--revoked');
  });

  it('throws when process exits with non-zero code', async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild('', 'fatal error', 1));

    await expect(
      runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-err' })
    ).rejects.toThrow('halo2 verifier exited with code 1');
  });

  it('throws when verifier emits no JSON output', async () => {
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild('not json at all', '', 0));

    await expect(
      runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-nojson' })
    ).rejects.toThrow('halo2 verifier did not emit JSON output');
  });

  it('throws when JSON is missing required ok field', async () => {
    const badJson = JSON.stringify({ mode: 'non-mem', proof_gen_ms: 10, gate_count: 0, k: 0, error: null });
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(badJson + '\n', '', 0));

    await expect(
      runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-bad' })
    ).rejects.toThrow('halo2 verifier payload missing required fields');
  });

  it('throws when JSON is missing required proof_gen_ms field', async () => {
    const badJson = JSON.stringify({ mode: 'non-mem', ok: true, gate_count: 0, k: 0, error: null });
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(badJson + '\n', '', 0));

    await expect(
      runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-bad2' })
    ).rejects.toThrow('halo2 verifier payload missing required fields');
  });

  it('picks the last JSON line when multiple JSON lines are present', async () => {
    const firstJson = JSON.stringify({ mode: 'non-mem', ok: false, proof_gen_ms: 1, gate_count: 0, k: 0, error: 'first' });
    const lastJson = JSON.stringify({ mode: 'non-mem', ok: true, proof_gen_ms: 99, gate_count: 0, k: 0, error: null });
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(`${firstJson}\n${lastJson}\n`, '', 0));

    const result = await runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-multi' });

    expect(result.ok).toBe(true);
    expect(result.proofGenMs).toBe(99);
  });

  it('propagates spawn error event as rejection', async () => {
    const child = new EventEmitter() as unknown as ChildProcess;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    (child as unknown as Record<string, unknown>).stdout = stdout;
    (child as unknown as Record<string, unknown>).stderr = stderr;

    process.nextTick(() => {
      child.emit('error', new Error('ENOENT'));
    });

    vi.mocked(spawn).mockReturnValueOnce(child);

    await expect(
      runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-enoent' })
    ).rejects.toThrow('ENOENT');
  });

  it('propagates error string in result when error field is non-null', async () => {
    const outputWithError = JSON.stringify({
      mode: 'non-mem',
      ok: false,
      proof_gen_ms: 10,
      gate_count: 0,
      k: 0,
      error: 'constraint failed'
    });
    vi.mocked(spawn).mockReturnValueOnce(makeMockChild(outputWithError + '\n', '', 0));

    const result = await runHalo2Verifier({ mode: 'non-mem', bundleHash: 'bundle-constrained' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('constraint failed');
  });
});
