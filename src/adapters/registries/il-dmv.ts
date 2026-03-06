import axios, { AxiosError } from 'axios';

export type IlDmvVerifyInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  licenseNumber: string;
};

export type IlDmvVerifyResult = {
  registryId: 'dmv_il';
  sourceName: 'Illinois DMV (via IDScan)';
  status: 'VERIFIED' | 'NOT_FOUND' | 'REVIEW';
  matchScore: number;
  proofInput: {
    registryId: 'dmv_il';
    provider: 'idscan';
    licenseNumberHash: string;
    result: 'VERIFIED' | 'NOT_FOUND' | 'REVIEW';
    checkedAt: string;
  };
  reason?: string;
  raw?: unknown;
};

const DEFAULT_BASE_URL = 'https://api.idscan.net/v1';

function hashLite(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function buildReviewResult(input: IlDmvVerifyInput, reason: string): IlDmvVerifyResult {
  const checkedAt = new Date().toISOString();
  return {
    registryId: 'dmv_il',
    sourceName: 'Illinois DMV (via IDScan)',
    status: 'REVIEW',
    matchScore: 0,
    proofInput: {
      registryId: 'dmv_il',
      provider: 'idscan',
      licenseNumberHash: hashLite(input.licenseNumber.trim().toUpperCase()),
      result: 'REVIEW',
      checkedAt
    },
    reason
  };
}

export async function verifyIllinoisDmvViaIdScan(input: IlDmvVerifyInput): Promise<IlDmvVerifyResult> {
  const apiKey = (process.env.IDSCAN_API_KEY || '').trim();
  const baseUrl = (process.env.IDSCAN_BASE_URL || DEFAULT_BASE_URL).trim();

  if (!apiKey) {
    return buildReviewResult(input, 'IDSCAN_API_KEY not configured');
  }

  const checkedAt = new Date().toISOString();
  const payload = {
    jurisdiction: 'IL',
    first_name: input.firstName,
    last_name: input.lastName,
    dob: input.dateOfBirth,
    license_number: input.licenseNumber
  };

  try {
    const response = await axios.post(`${baseUrl}/dmv/verify`, payload, {
      timeout: 15000,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'TrustSignal-RegistryAdapter/1.0'
      }
    });

    const body = (response.data || {}) as Record<string, unknown>;
    const matched = Boolean(body.matched);
    const status: IlDmvVerifyResult['status'] = matched ? 'VERIFIED' : 'NOT_FOUND';
    const scoreRaw = typeof body.score === 'number' ? body.score : matched ? 1 : 0;
    const matchScore = Math.max(0, Math.min(1, scoreRaw));

    return {
      registryId: 'dmv_il',
      sourceName: 'Illinois DMV (via IDScan)',
      status,
      matchScore,
      proofInput: {
        registryId: 'dmv_il',
        provider: 'idscan',
        licenseNumberHash: hashLite(input.licenseNumber.trim().toUpperCase()),
        result: status,
        checkedAt
      },
      raw: body
    };
  } catch (error) {
    const err = error as AxiosError;
    if (err.response?.status === 404) {
      return {
        registryId: 'dmv_il',
        sourceName: 'Illinois DMV (via IDScan)',
        status: 'NOT_FOUND',
        matchScore: 0,
        proofInput: {
          registryId: 'dmv_il',
          provider: 'idscan',
          licenseNumberHash: hashLite(input.licenseNumber.trim().toUpperCase()),
          result: 'NOT_FOUND',
          checkedAt
        },
        raw: err.response.data
      };
    }

    return buildReviewResult(input, `idscan_error_${err.response?.status || 'unknown'}`);
  }
}
