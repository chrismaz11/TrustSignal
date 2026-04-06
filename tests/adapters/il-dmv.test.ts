import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyIllinoisDmvViaIdScan } from '../../src/adapters/registries/il-dmv.js';

vi.mock('axios', () => {
  const post = vi.fn();
  return {
    default: { post },
    post
  };
});

import axios from 'axios';

const baseInput = {
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01',
  licenseNumber: 'D1234567'
};

function makeAxiosError(status: number | undefined, data: unknown = {}): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: status !== undefined ? { status, data } : undefined
  });
}

describe('verifyIllinoisDmvViaIdScan', () => {
  const savedKey = process.env.IDSCAN_API_KEY;
  const savedUrl = process.env.IDSCAN_BASE_URL;

  beforeEach(() => {
    delete process.env.IDSCAN_API_KEY;
    delete process.env.IDSCAN_BASE_URL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedKey === undefined) {
      delete process.env.IDSCAN_API_KEY;
    } else {
      process.env.IDSCAN_API_KEY = savedKey;
    }
    if (savedUrl === undefined) {
      delete process.env.IDSCAN_BASE_URL;
    } else {
      process.env.IDSCAN_BASE_URL = savedUrl;
    }
    vi.restoreAllMocks();
  });

  it('returns REVIEW with reason when IDSCAN_API_KEY is not configured', async () => {
    const result = await verifyIllinoisDmvViaIdScan(baseInput);
    expect(result.status).toBe('REVIEW');
    expect(result.reason).toBe('IDSCAN_API_KEY not configured');
    expect(result.registryId).toBe('dmv_il');
    expect(result.sourceName).toBe('Illinois DMV (via IDScan)');
    expect(result.matchScore).toBe(0);
  });

  it('returns VERIFIED with score when API returns matched=true', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: true, score: 0.95 } });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.status).toBe('VERIFIED');
    expect(result.matchScore).toBe(0.95);
    expect(result.proofInput.result).toBe('VERIFIED');
    expect(result.proofInput.provider).toBe('idscan');
    expect(result.proofInput.licenseNumberHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns NOT_FOUND when API returns matched=false', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: false } });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.status).toBe('NOT_FOUND');
    expect(result.matchScore).toBe(0);
  });

  it('defaults matchScore to 1 when matched=true and score is absent', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: true } });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.matchScore).toBe(1);
  });

  it('clamps score above 1 to exactly 1', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: true, score: 2.5 } });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.matchScore).toBe(1);
  });

  it('clamps negative score to 0', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: false, score: -0.5 } });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.matchScore).toBe(0);
  });

  it('returns NOT_FOUND with raw data on HTTP 404 from API', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockRejectedValueOnce(makeAxiosError(404, { message: 'record not found' }));

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.status).toBe('NOT_FOUND');
    expect(result.matchScore).toBe(0);
    expect(result.raw).toEqual({ message: 'record not found' });
  });

  it('returns REVIEW with status code in reason on HTTP 500', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockRejectedValueOnce(makeAxiosError(500, {}));

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.status).toBe('REVIEW');
    expect(result.reason).toBe('idscan_error_500');
  });

  it('returns REVIEW with unknown status on network error (no response)', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockRejectedValueOnce(makeAxiosError(undefined));

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.status).toBe('REVIEW');
    expect(result.reason).toBe('idscan_error_unknown');
  });

  it('uses custom IDSCAN_BASE_URL when set', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    process.env.IDSCAN_BASE_URL = 'https://custom.example.com/v2';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: true } });

    await verifyIllinoisDmvViaIdScan(baseInput);

    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
      'https://custom.example.com/v2/dmv/verify',
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('sends correct payload fields to IDScan API', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { matched: true } });

    await verifyIllinoisDmvViaIdScan(baseInput);

    expect(vi.mocked(axios.post)).toHaveBeenCalledWith(
      expect.any(String),
      {
        jurisdiction: 'IL',
        first_name: 'John',
        last_name: 'Doe',
        dob: '1990-01-01',
        license_number: 'D1234567'
      },
      expect.objectContaining({
        timeout: 15000,
        headers: expect.objectContaining({
          'content-type': 'application/json'
        })
      })
    );
  });

  it('includes raw API response body in successful result', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    const apiBody = { matched: true, score: 0.9, extra: 'data' };
    vi.mocked(axios.post).mockResolvedValueOnce({ data: apiBody });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result.raw).toEqual(apiBody);
  });

  it('handles null response.data gracefully by treating as NOT_FOUND', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post).mockResolvedValueOnce({ data: null });

    const result = await verifyIllinoisDmvViaIdScan(baseInput);

    // matched = Boolean(null.matched) would throw, but body = (null || {})
    // so matched = Boolean(undefined) = false → NOT_FOUND
    expect(result.status).toBe('NOT_FOUND');
    expect(result.matchScore).toBe(0);
  });

  it('produces stable hash for the same license number across calls', async () => {
    process.env.IDSCAN_API_KEY = 'test-api-key';
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { matched: true } })
      .mockResolvedValueOnce({ data: { matched: true } });

    const result1 = await verifyIllinoisDmvViaIdScan(baseInput);
    const result2 = await verifyIllinoisDmvViaIdScan(baseInput);

    expect(result1.proofInput.licenseNumberHash).toBe(result2.proofInput.licenseNumberHash);
  });
});
