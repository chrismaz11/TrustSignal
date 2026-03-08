import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  options: { preferDirect?: boolean } = {}
): string | null {
  const candidateGroups = options.preferDirect
    ? [
        env.DIRECT_URL,
        env.SUPABASE_DIRECT_URL,
        env.DATABASE_URL,
        env.SUPABASE_DB_URL,
        env.SUPABASE_POOLER_URL
      ]
    : [
        env.DATABASE_URL,
        env.SUPABASE_DB_URL,
        env.SUPABASE_POOLER_URL,
        env.SUPABASE_DIRECT_URL
      ];

  for (const candidate of candidateGroups) {
    const value = candidate?.trim();
    if (value) {
      if (!options.preferDirect) {
        env.DATABASE_URL = value;
      }
      return value;
    }
  }

  const supabasePassword = (env.SUPABASE_DB_PASSWORD || '').trim();
  if (!supabasePassword || options.preferDirect) {
    return null;
  }

  const poolerCandidates = [
    path.resolve(process.cwd(), 'supabase/.temp/pooler-url'),
    path.resolve(process.cwd(), '../../supabase/.temp/pooler-url'),
    path.resolve(process.env.HOME || '', 'supabase/.temp/pooler-url')
  ];
  for (const poolerPath of poolerCandidates) {
    try {
      const rawPoolerUrl = readFileSync(poolerPath, 'utf-8').trim();
      if (!rawPoolerUrl) continue;
      const parsed = new URL(rawPoolerUrl);
      if (!parsed.password) {
        parsed.password = encodeURIComponent(supabasePassword);
      }
      parsed.searchParams.set('sslmode', 'require');
      const resolved = parsed.toString();
      env.DATABASE_URL = resolved;
      return resolved;
    } catch {
      continue;
    }
  }

  return null;
}

type PrismaGlobals = typeof globalThis & {
  __trustSignalPrismaClient?: PrismaClient;
  __trustSignalPrismaPool?: Pool;
};

export function createPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const connectionString = resolveDatabaseUrl(env);
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL or SUPABASE_DB_URL / SUPABASE_POOLER_URL / SUPABASE_DIRECT_URL.'
    );
  }

  const pool = new Pool({
    connectionString
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter
  });

  const globals = globalThis as PrismaGlobals;
  globals.__trustSignalPrismaPool = pool;

  return client;
}

export function getPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const globals = globalThis as PrismaGlobals;
  if (globals.__trustSignalPrismaClient) {
    return globals.__trustSignalPrismaClient;
  }

  const client = createPrismaClient(env);
  if ((env.NODE_ENV || 'development') !== 'production') {
    globals.__trustSignalPrismaClient = client;
  }

  return client;
}
