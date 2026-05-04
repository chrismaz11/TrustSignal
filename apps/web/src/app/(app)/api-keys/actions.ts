'use server';

import crypto from 'node:crypto';

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Generate a new API key.
 * Returns the FULL key once (for display) and the hash for storage.
 * The caller must store only the hash. The full key is never persisted.
 */
export async function generateApiKey(name: string): Promise<{
  rawKey: string;
  prefix: string;
  hash: string;
  id: string;
  name: string;
  createdAt: string;
}> {
  if (!name || name.trim().length < 3) {
    throw new Error('Key name must be at least 3 characters.');
  }

  const rawBytes = crypto.randomBytes(32);
  const rawKey = `ts_live_${rawBytes.toString('base64url')}`;
  const prefix = rawKey.slice(0, 12); // e.g. "ts_live_XXXX"
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // TODO: persist { id, name, prefix, hash, createdAt } to database
  // await db.apiKeys.create({ data: { id, tenantId, name, prefix, hash, createdAt } })

  return { rawKey, prefix, hash, id, name: name.trim(), createdAt };
}

/**
 * List API keys for the current tenant (prefix + metadata only, never the raw key or hash).
 */
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  // TODO: fetch from DB filtered by tenant from session
  // return await db.apiKeys.findMany({ where: { tenantId, revokedAt: null }, orderBy: { createdAt: 'desc' } })
  return [];
}

/**
 * Revoke an API key by ID.
 */
export async function revokeApiKey(id: string): Promise<void> {
  if (!id) throw new Error('Key ID required.');
  // TODO: await db.apiKeys.update({ where: { id }, data: { revokedAt: new Date().toISOString() } })
}
