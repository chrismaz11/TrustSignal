import { createHash, generateKeyPairSync } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { getAddress, verifyMessage } from 'ethers';
import { FastifyReply, FastifyRequest } from 'fastify';
import { type JWK } from 'jose';

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
  apiKeyId: string | null;
  apiKeyHash: string;
  authSource: 'database' | 'local-dev';
  userId: string | null;
  scopes: Set<string>;
};

export type SecurityConfig = {
  localDevApiKeys: Map<string, Set<string>>;
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

function parsePublicJwkMap(
  value: string | undefined,
  envName = 'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS'
): Map<string, JWK> {
  const raw = (value || '').trim();
  if (!raw) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${envName} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${envName} must be a JSON object keyed by kid`);
  }

  const keyMap = new Map<string, JWK>();
  for (const [kid, jwk] of Object.entries(parsed)) {
    if (!kid || typeof jwk !== 'object' || jwk === null || Array.isArray(jwk) || typeof (jwk as JWK).kty !== 'string') {
      throw new Error(`${envName} contains invalid JWK for kid "${kid}"`);
    }
    keyMap.set(kid, jwk as JWK);
  }

  return keyMap;
}

export function buildReceiptSigningConfig(env: NodeJS.ProcessEnv = process.env): ReceiptSigningConfig {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const privateJwkRaw = env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK ?? env.TRUSTSIGNAL_SIGNING_PRIVATE_JWK;
  const publicJwkRaw = env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK;
  const kid = (env.TRUSTSIGNAL_RECEIPT_SIGNING_KID || env.TRUSTSIGNAL_SIGNING_KEY_ID || '').trim();
  const publicJwksRaw = env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS ?? env.TRUSTSIGNAL_PUBLIC_JWKS;

  const privateJwk = parseJsonJwk(
    privateJwkRaw,
    env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK ? 'TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK' : 'TRUSTSIGNAL_SIGNING_PRIVATE_JWK'
  );
  const publicJwk = parseJsonJwk(publicJwkRaw, 'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK');
  const verificationKeys = parsePublicJwkMap(
    publicJwksRaw,
    env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS ? 'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS' : 'TRUSTSIGNAL_PUBLIC_JWKS'
  );

  const publicFromJwks = kid ? verificationKeys.get(kid) : undefined;
  const resolvedPublicJwk = publicJwk ?? publicFromJwks ?? null;

  if (privateJwk && resolvedPublicJwk && kid) {
    verificationKeys.set(kid, resolvedPublicJwk);
    return {
      mode: 'configured',
      current: {
        privateJwk,
        publicJwk: resolvedPublicJwk,
        kid,
        alg: 'EdDSA'
      },
      verificationKeys
    };
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'Missing required production receipt-signing env vars: TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK (or TRUSTSIGNAL_SIGNING_PRIVATE_JWK), TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK (or TRUSTSIGNAL_PUBLIC_JWKS containing the signing key), TRUSTSIGNAL_RECEIPT_SIGNING_KID (or TRUSTSIGNAL_SIGNING_KEY_ID)'
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
  const defaultScopes = parseScopes(env.TRUSTSIGNAL_LOCAL_DEV_API_KEY_DEFAULT_SCOPES);
  const scopedMappings = parseApiKeyScopeMapping(env.TRUSTSIGNAL_LOCAL_DEV_API_KEY_SCOPES);
  const localDevApiKeys = new Map<string, Set<string>>();

  if (nodeEnv !== 'production') {
    for (const key of parseList(env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS)) {
      localDevApiKeys.set(key, scopedMappings.get(key) ?? new Set(defaultScopes));
    }
  }

  return {
    localDevApiKeys,
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

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function fingerprintApiKey(apiKey: string): string {
  return hashApiKey(apiKey).slice(0, 16);
}

function readPresentedCredential(request: FastifyRequest): string | null {
  const apiKey = readHeader(request, 'x-api-key');
  if (apiKey) return apiKey;

  const authorization = readHeader(request, 'authorization');
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

type ApiKeyRecord = {
  id: string;
  user_id: string;
  key_hash: string;
  scopes: string[] | null;
  revoked_at: Date | null;
  expires_at: Date | null;
};

async function findDatabaseApiKey(prisma: PrismaClient, apiKeyHash: string): Promise<ApiKeyRecord | null> {
  const records = await prisma.$queryRaw<ApiKeyRecord[]>`
    select
      id,
      user_id,
      key_hash,
      scopes,
      revoked_at,
      nullif(to_jsonb(api_keys)->>'expires_at', '')::timestamptz as expires_at
    from public.api_keys
    where key_hash = ${apiKeyHash}
    limit 1
  `;

  return records[0] ?? null;
}

async function touchApiKey(prisma: PrismaClient, apiKeyId: string) {
  await prisma.$executeRaw`
    update public.api_keys
    set last_used_at = timezone('utc', now())
    where id = ${apiKeyId}
  `;
}

export function requireApiKeyScope(prisma: PrismaClient, config: SecurityConfig, requiredScope: AuthScope) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const apiKey = readPresentedCredential(request);
    if (!apiKey) {
      reply.code(401).send({ error: 'Unauthorized: missing bearer token or x-api-key' });
      return;
    }

    const apiKeyHash = hashApiKey(apiKey);
    const localScopes = config.localDevApiKeys.get(apiKey);

    if (localScopes) {
      if (!localScopes.has('*') && !localScopes.has(requiredScope)) {
        reply.code(403).send({ error: `Forbidden: missing scope ${requiredScope}` });
        return;
      }

      request.authContext = {
        apiKey,
        apiKeyId: null,
        apiKeyHash,
        authSource: 'local-dev',
        userId: null,
        scopes: localScopes
      };
      return;
    }

    let record: ApiKeyRecord | null = null;
    try {
      record = await findDatabaseApiKey(prisma, apiKeyHash);
    } catch (error) {
      reply.code(503).send({
        error: 'Database unavailable',
        details: error instanceof Error ? error.message : 'api_key_lookup_failed'
      });
      return;
    }

    if (!record) {
      reply.code(403).send({ error: 'Forbidden: invalid API key' });
      return;
    }

    if (record.revoked_at) {
      reply.code(403).send({ error: 'Forbidden: revoked API key' });
      return;
    }

    if (record.expires_at && record.expires_at.getTime() <= Date.now()) {
      reply.code(403).send({ error: 'Forbidden: expired API key' });
      return;
    }

    const scopes = new Set(record.scopes ?? []);
    if (!scopes.has('*') && !scopes.has(requiredScope)) {
      reply.code(403).send({ error: `Forbidden: missing scope ${requiredScope}` });
      return;
    }

    try {
      await touchApiKey(prisma, record.id);
    } catch {
      reply.code(503).send({ error: 'Database unavailable', details: 'api_key_touch_failed' });
      return;
    }

    request.authContext = {
      apiKey,
      apiKeyId: record.id,
      apiKeyHash,
      authSource: 'database',
      userId: record.user_id,
      scopes
    };
  };
}

export function getApiRateLimitKey(request: FastifyRequest): string {
  const apiKey = readPresentedCredential(request);
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

// ─── Plan quota enforcement ───────────────────────────────────────────────────

const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  free: 1_000,
  pro: 100_000,
  enterprise: Infinity
};

/**
 * Check whether the API key owner is within their monthly verification quota.
 * Returns { allowed: true } or { allowed: false, plan, used, limit }.
 *
 * Queries public.verification_log for the current calendar month.
 * Falls back to allowing the request if the customers table is not yet configured.
 */
export async function checkPlanQuota(
  prisma: PrismaClient,
  userId: string | null
): Promise<{ allowed: true } | { allowed: false; plan: string; used: number; limit: number }> {
  if (!userId) return { allowed: true }; // local-dev keys have no quota

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const result = await prisma.$queryRaw<Array<{ plan: string | null; used: bigint }>>`
      select
        c.plan,
        count(vl.id) as used
      from public.verification_log vl
      left join public.customers c on c.user_id = ${userId}::uuid
      where
        vl.user_id = ${userId}::uuid
        and vl.created_at >= ${monthStart}::timestamptz
      group by c.plan
    `;

    const row = result[0];
    const plan = row?.plan ?? 'free';
    const used = Number(row?.used ?? 0);
    const limit = PLAN_MONTHLY_LIMITS[plan] ?? PLAN_MONTHLY_LIMITS['free'];

    if (!Number.isFinite(limit)) return { allowed: true }; // enterprise = unlimited

    if (used >= limit) {
      return { allowed: false, plan, used, limit };
    }

    return { allowed: true };
  } catch {
    // If the customers table does not exist yet, allow the request.
    return { allowed: true };
  }
}
