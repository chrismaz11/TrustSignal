import { createHash, generateKeyPairSync } from 'node:crypto';

import { getAddress, verifyMessage } from 'ethers';
import { FastifyReply, FastifyRequest } from 'fastify';
import { type JWK } from 'jose';

const DEFAULT_API_KEY = 'example_local_key_id';
const DEFAULT_SCOPES = ['verify', 'read', 'anchor', 'revoke'];
const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
const DEV_RECEIPT_SIGNING_KID = 'dev-local-receipt-signer-v1';
const DEV_RECEIPT_SIGNING_KEYS = (() => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateJwk: privateKey.export({ format: 'jwk' }) as JWK,
    publicJwk: publicKey.export({ format: 'jwk' }) as JWK
  };
})();

export type AuthScope = 'verify' | 'read' | 'anchor' | 'revoke';

export type AuthContext = {
  apiKey: string;
  apiKeyHash: string;
  scopes: Set<string>;
};

export type SecurityConfig = {
  apiKeys: Map<string, Set<string>>;
  revocationIssuers: Map<string, string>;
  revocationMaxSkewMs: number;
  globalRateLimitMax: number;
  perApiKeyRateLimitMax: number;
  rateLimitWindow: string;
  corsAllowlist: Set<string>;
  receiptSigning: ReceiptSigningConfig;
};

export type ReceiptSigningConfig = {
  mode: 'configured' | 'dev-only';
  current: {
    privateJwk: JWK;
    publicJwk: JWK;
    kid: string;
    alg: 'EdDSA';
  };
  verificationKeys: Map<string, JWK>;
};

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseScopes(value: string | undefined): Set<string> {
  const scopes = parseList(value);
  return scopes.length ? new Set(scopes) : new Set(DEFAULT_SCOPES);
}

function parseApiKeyScopeMapping(value: string | undefined): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  if (!value) return result;

  for (const pair of value.split(';').map((entry) => entry.trim()).filter(Boolean)) {
    const [apiKey, scopesRaw] = pair.split('=');
    const key = apiKey?.trim();
    if (!key) continue;

    const scopes = scopesRaw
      ? scopesRaw
          .split('|')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : [];

    result.set(key, scopes.length ? new Set(scopes) : new Set(DEFAULT_SCOPES));
  }

  return result;
}

function parseRevocationIssuers(value: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!value) return result;

  for (const pair of value.split(';').map((entry) => entry.trim()).filter(Boolean)) {
    const [issuerIdRaw, addressRaw] = pair.split('=');
    const issuerId = issuerIdRaw?.trim();
    const address = addressRaw?.trim();
    if (!issuerId || !address) continue;

    try {
      result.set(issuerId, getAddress(address));
    } catch {
      continue;
    }
  }

  return result;
}

function buildCorsAllowlist(nodeEnv: string, configured: string | undefined): Set<string> {
  const parsed = parseList(configured);
  if (parsed.length > 0) {
    return new Set(parsed);
  }

  return nodeEnv === 'production' ? new Set() : new Set(DEFAULT_DEV_CORS_ORIGINS);
}

function parseJsonJwk(value: string | undefined, envName: string): JWK | null {
  const raw = (value || '').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as JWK;
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.kty !== 'string') {
      throw new Error('invalid_jwk_shape');
    }
    return parsed;
  } catch (error) {
    throw new Error(`${envName} must be valid JSON JWK: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parsePublicJwkMap(value: string | undefined): Map<string, JWK> {
  const raw = (value || '').trim();
  if (!raw) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS must be a JSON object keyed by kid');
  }

  const keyMap = new Map<string, JWK>();
  for (const [kid, jwk] of Object.entries(parsed)) {
    if (!kid || typeof jwk !== 'object' || jwk === null || Array.isArray(jwk) || typeof (jwk as JWK).kty !== 'string') {
      throw new Error(`TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS contains invalid JWK for kid "${kid}"`);
    }
    keyMap.set(kid, jwk as JWK);
  }

  return keyMap;
}

export function buildReceiptSigningConfig(env: NodeJS.ProcessEnv = process.env): ReceiptSigningConfig {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const privateJwk = parseJsonJwk(env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK, 'TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK');
  const publicJwk = parseJsonJwk(env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK, 'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK');
  const kid = (env.TRUSTSIGNAL_RECEIPT_SIGNING_KID || '').trim();
  const verificationKeys = parsePublicJwkMap(env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS);

  if (privateJwk && publicJwk && kid) {
    verificationKeys.set(kid, publicJwk);
    return {
      mode: 'configured',
      current: {
        privateJwk,
        publicJwk,
        kid,
        alg: 'EdDSA'
      },
      verificationKeys
    };
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'Missing required production receipt-signing env vars: TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK, TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK, TRUSTSIGNAL_RECEIPT_SIGNING_KID'
    );
  }

  const devVerificationKeys = verificationKeys.size > 0 ? verificationKeys : new Map<string, JWK>();
  devVerificationKeys.set(DEV_RECEIPT_SIGNING_KID, DEV_RECEIPT_SIGNING_KEYS.publicJwk);

  return {
    mode: 'dev-only',
    current: {
      privateJwk: DEV_RECEIPT_SIGNING_KEYS.privateJwk,
      publicJwk: DEV_RECEIPT_SIGNING_KEYS.publicJwk,
      kid: DEV_RECEIPT_SIGNING_KID,
      alg: 'EdDSA'
    },
    verificationKeys: devVerificationKeys
  };
}

export function buildSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const nodeEnv = env.NODE_ENV || 'development';
  const defaultScopes = parseScopes(env.API_KEY_DEFAULT_SCOPES);
  const scopedMappings = parseApiKeyScopeMapping(env.API_KEY_SCOPES);

  const apiKeys = parseList(env.API_KEYS);
  const resolvedApiKeys = apiKeys.length > 0 ? apiKeys : nodeEnv === 'production' ? [] : [DEFAULT_API_KEY];

  if (nodeEnv === 'production' && resolvedApiKeys.length === 0) {
    throw new Error('API_KEYS is required in production');
  }

  const keyMap = new Map<string, Set<string>>();
  for (const key of resolvedApiKeys) {
    keyMap.set(key, scopedMappings.get(key) ?? new Set(defaultScopes));
  }

  return {
    apiKeys: keyMap,
    revocationIssuers: parseRevocationIssuers(env.REVOCATION_ISSUERS),
    revocationMaxSkewMs: parseInteger(env.REVOCATION_SIGNATURE_MAX_SKEW_MS, 5 * 60 * 1000),
    globalRateLimitMax: parseInteger(env.RATE_LIMIT_GLOBAL_MAX, 600),
    perApiKeyRateLimitMax: parseInteger(env.RATE_LIMIT_API_KEY_MAX, 120),
    rateLimitWindow: env.RATE_LIMIT_WINDOW || '1 minute',
    corsAllowlist: buildCorsAllowlist(nodeEnv, env.CORS_ALLOWLIST),
    receiptSigning: buildReceiptSigningConfig(env)
  };
}

function readHeader(request: FastifyRequest, headerName: string): string | null {
  const value = request.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) return value[0] || null;
  if (typeof value === 'string') return value;
  return null;
}

function fingerprintApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

export function requireApiKeyScope(config: SecurityConfig, requiredScope: AuthScope) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const apiKey = readHeader(request, 'x-api-key');
    if (!apiKey) {
      reply.code(401).send({ error: 'Unauthorized: missing x-api-key' });
      return;
    }

    const scopes = config.apiKeys.get(apiKey);
    if (!scopes) {
      reply.code(403).send({ error: 'Forbidden: invalid API key' });
      return;
    }

    if (!scopes.has('*') && !scopes.has(requiredScope)) {
      reply.code(403).send({ error: `Forbidden: missing scope ${requiredScope}` });
      return;
    }

    request.authContext = {
      apiKey,
      apiKeyHash: fingerprintApiKey(apiKey),
      scopes
    };
  };
}

export function getApiRateLimitKey(request: FastifyRequest): string {
  const apiKey = readHeader(request, 'x-api-key');
  return apiKey ? fingerprintApiKey(apiKey) : request.ip;
}

export function isCorsOriginAllowed(config: SecurityConfig, origin: string | undefined): boolean {
  if (!origin) return true;
  if (config.corsAllowlist.size === 0) return false;
  return config.corsAllowlist.has(origin);
}

export function verifyRevocationHeaders(
  request: FastifyRequest,
  receiptId: string,
  config: SecurityConfig
): { ok: true; issuerId: string } | { ok: false; error: string } {
  const issuerId = readHeader(request, 'x-issuer-id');
  const signature = readHeader(request, 'x-issuer-signature');
  const timestampRaw = readHeader(request, 'x-signature-timestamp');

  if (!issuerId || !signature || !timestampRaw) {
    return { ok: false, error: 'missing_revocation_signature_headers' };
  }

  const expectedAddress = config.revocationIssuers.get(issuerId);
  if (!expectedAddress) {
    return { ok: false, error: 'issuer_not_allowed' };
  }

  const timestampMs = /^\d+$/.test(timestampRaw)
    ? Number.parseInt(timestampRaw, 10)
    : Date.parse(timestampRaw);

  if (!Number.isFinite(timestampMs)) {
    return { ok: false, error: 'invalid_signature_timestamp' };
  }

  if (Math.abs(Date.now() - timestampMs) > config.revocationMaxSkewMs) {
    return { ok: false, error: 'stale_signature_timestamp' };
  }

  const message = `revoke:${receiptId}:${timestampRaw}`;

  let recoveredAddress: string;
  try {
    recoveredAddress = getAddress(verifyMessage(message, signature));
  } catch {
    return { ok: false, error: 'invalid_signature' };
  }

  if (recoveredAddress !== expectedAddress) {
    return { ok: false, error: 'signature_mismatch' };
  }

  return { ok: true, issuerId };
}
