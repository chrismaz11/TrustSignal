import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import {
  createLocalJWKSet,
  createRemoteJWKSet,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
  type JWTVerifyResult
} from 'jose';
import { z } from 'zod';

import type { AccessTokenConfig, AuthScope } from './security.js';

const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
const AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';
const SUPPORTED_SCOPES = ['verify', 'read', 'anchor', 'revoke'] as const;
const SUPPORTED_CLIENT_TYPES = ['machine', 'integration', 'browser'] as const;
const ASSERTION_MAX_AGE = '5m';
const PKCE_CODE_CHALLENGE_METHOD = 'S256' as const;
const PASSWORD_MIN_LENGTH = 12;
const scryptAsync = promisify(scrypt);
const scopeEnum = z.enum(SUPPORTED_SCOPES);

const jwkSchema = z.object({ kty: z.string().min(1) }).passthrough();
const redirectUriSchema = z.string().trim().url().max(2048);
const codeChallengeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{43,128}$/);
const codeVerifierSchema = z.string().trim().regex(/^[A-Za-z0-9._~-]{43,128}$/);
const jwksSchema = z.union([
  jwkSchema,
  z.object({
    keys: z.array(jwkSchema).min(1)
  }).passthrough()
]);

export const clientRegistrationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    userEmail: z.string().trim().email().optional(),
    clientType: z.enum(SUPPORTED_CLIENT_TYPES).default('machine'),
    jwks: jwksSchema.optional(),
    jwksUrl: z.string().trim().url().optional(),
    redirectUris: z.array(redirectUriSchema).min(1).max(20).optional(),
    scopes: z.array(scopeEnum).min(1).max(SUPPORTED_SCOPES.length).optional()
  })
  .superRefine((value, ctx) => {
    if (value.clientType === 'browser') {
      if ((value.redirectUris || []).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide redirectUris for browser clients',
          path: ['redirectUris']
        });
      }
      if (value.jwks || value.jwksUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Browser clients cannot register jwks or jwksUrl',
          path: ['jwks']
        });
      }
      return;
    }

    if (!value.jwks && !value.jwksUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide jwks or jwksUrl',
        path: ['jwks']
      });
    }
  });

const clientCredentialsTokenRequestSchema = z.object({
  grant_type: z.literal('client_credentials'),
  client_assertion_type: z.literal(CLIENT_ASSERTION_TYPE),
  client_assertion: z.string().trim().min(1),
  scope: z.string().trim().optional()
});

export const authorizationCodeTokenRequestSchema = z.object({
  grant_type: z.literal(AUTHORIZATION_CODE_GRANT_TYPE),
  code: z.string().trim().min(1),
  redirect_uri: redirectUriSchema,
  client_id: z.string().trim().min(1),
  code_verifier: codeVerifierSchema
});

export const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  clientCredentialsTokenRequestSchema,
  authorizationCodeTokenRequestSchema
]);

export const oauthUserRegistrationSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  displayName: z.string().trim().min(1).max(120).optional()
});

export const oauthLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  return_to: z.string().trim().max(4096).optional()
});

export const oauthAuthorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().trim().min(1),
  redirect_uri: redirectUriSchema,
  scope: z.string().trim().optional(),
  state: z.string().trim().max(2048).optional(),
  prompt: z.enum(['none', 'consent']).optional(),
  code_challenge: codeChallengeSchema,
  code_challenge_method: z.literal(PKCE_CODE_CHALLENGE_METHOD)
});

export const oauthAuthorizeDecisionSchema = z.object({
  request_id: z.string().trim().min(1),
  decision: z.enum(['approve', 'deny'])
});

type RegisteredClient = {
  id: string;
  clientType: string;
  scopes: string;
  plan: string;
  usageLimit: number;
  usageCount: number;
  revokedAt: Date | null;
  jwks: unknown;
  jwksUrl: string | null;
};

function parseScopeSet(raw: string | null | undefined): Set<AuthScope> {
  const result = new Set<AuthScope>();

  for (const part of (raw || '').split(/[\s,|]+/)) {
    const scope = part.trim() as AuthScope;
    if ((SUPPORTED_SCOPES as readonly string[]).includes(scope)) {
      result.add(scope);
    }
  }

  return result;
}

export function normalizeJwks(value: unknown): { keys: JWK[] } {
  const parsed = jwksSchema.parse(value);
  if ('keys' in parsed) {
    return { keys: parsed.keys as JWK[] };
  }

  return { keys: [parsed as JWK] };
}

export function hashOpaqueToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function issueOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export async function hashPasswordRecord(password: string): Promise<{ passwordHash: string; passwordSalt: string }> {
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return {
    passwordHash: Buffer.from(derived).toString('base64url'),
    passwordSalt: salt
  };
}

export async function hashPassword(password: string): Promise<string> {
  const { passwordHash, passwordSalt } = await hashPasswordRecord(password);
  return `scrypt$${passwordSalt}$${passwordHash}`;
}

export async function verifyPasswordHash(
  password: string,
  storedHash: string | null | undefined,
  storedSalt?: string | null | undefined
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const [algorithm, saltEncoded, hashEncoded] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltEncoded || !hashEncoded) {
    if (!storedSalt) {
      return false;
    }

    const expected = Buffer.from(storedHash, 'base64url');
    const derived = (await scryptAsync(password, storedSalt, expected.length)) as Buffer;
    if (derived.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(derived), expected);
  }

  const salt = Buffer.from(saltEncoded, 'base64url');
  const expected = Buffer.from(hashEncoded, 'base64url');
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;
  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(derived), expected);
}

export function derivePkceCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function verifyPkceCodeVerifier(codeVerifier: string, expectedChallenge: string): boolean {
  const derived = Buffer.from(derivePkceCodeChallenge(codeVerifier));
  const expected = Buffer.from(expectedChallenge);
  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

function buildAssertionAudiences(tokenAudience: string, requestUrl?: string): string[] {
  return Array.from(new Set([tokenAudience, requestUrl].map((value) => (value || '').trim()).filter(Boolean)));
}

async function resolveAssertionKeySet(client: RegisteredClient) {
  if (client.jwks) {
    return createLocalJWKSet(normalizeJwks(client.jwks));
  }

  if (client.jwksUrl) {
    return createRemoteJWKSet(new URL(client.jwksUrl));
  }

  throw new Error('client_has_no_registered_jwks');
}

export function resolveGrantedScopes(allowedScopesRaw: string, requestedScopesRaw?: string): string {
  const allowedScopes = parseScopeSet(allowedScopesRaw);
  const requestedScopes = parseScopeSet(requestedScopesRaw);

  if (requestedScopes.size === 0) {
    return Array.from(allowedScopes).join(' ');
  }

  const granted = Array.from(requestedScopes).filter((scope) => allowedScopes.has(scope));
  return granted.join(' ');
}

export async function verifyClientAssertion(input: {
  client: RegisteredClient;
  clientAssertion: string;
  tokenAudience: string;
  requestUrl?: string;
}): Promise<JWTVerifyResult> {
  const keySet = await resolveAssertionKeySet(input.client);

  return jwtVerify(input.clientAssertion, keySet, {
    issuer: input.client.id,
    subject: input.client.id,
    audience: buildAssertionAudiences(input.tokenAudience, input.requestUrl),
    algorithms: ['RS256', 'PS256', 'ES256', 'EdDSA'],
    clockTolerance: '5s',
    maxTokenAge: ASSERTION_MAX_AGE
  });
}

export async function issueAccessToken(input: {
  client: RegisteredClient;
  requestedScope?: string;
  accessTokenConfig: AccessTokenConfig;
  subject?: string;
  additionalClaims?: Record<string, unknown>;
}) {
  const grantedScope = resolveGrantedScopes(input.client.scopes, input.requestedScope);
  if (!grantedScope) {
    throw new Error('invalid_scope');
  }

  const privateKey = await importJWK(
    input.accessTokenConfig.current.privateJwk,
    input.accessTokenConfig.current.alg
  );

  const accessToken = await new SignJWT({
    scope: grantedScope,
    plan: input.client.plan,
    usage_limit: input.client.usageLimit,
    client_type: input.client.clientType,
    ...(input.additionalClaims || {})
  })
    .setProtectedHeader({
      alg: input.accessTokenConfig.current.alg,
      kid: input.accessTokenConfig.current.kid,
      typ: 'at+jwt'
    })
    .setIssuer(input.accessTokenConfig.issuer)
    .setAudience(input.accessTokenConfig.audience)
    .setSubject(input.subject || input.client.id)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${input.accessTokenConfig.ttlSeconds}s`)
    .sign(privateKey);

  return {
    accessToken,
    expiresIn: input.accessTokenConfig.ttlSeconds,
    scope: grantedScope
  };
}
