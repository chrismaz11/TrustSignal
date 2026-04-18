import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let runtimeEnvLoaded = false;

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function loadRuntimeEnv(): void {
  if (runtimeEnvLoaded) {
    return;
  }

  const envFiles = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env')
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  runtimeEnvLoaded = true;
}

/**
 * Validates that all required environment variables are set.
 * Call at startup before the server begins listening.
 */
export function validateRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  const required: string[] = [];

  // DATABASE_URL is always required (may be set via alias — check after resolveDatabaseUrl runs)
  if (!env.DATABASE_URL && !env.SUPABASE_DB_URL && !env.SUPABASE_POOLER_URL && !env.SUPABASE_DIRECT_URL) {
    required.push('DATABASE_URL');
  }

  // In production, receipt signing keys must be explicitly configured
  if (env.NODE_ENV === 'production') {
    if (
      !env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK &&
      !env.TRUSTSIGNAL_SIGNING_PRIVATE_JWK
    ) {
      required.push('TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK');
    }
    if (
      !env.TRUSTSIGNAL_RECEIPT_SIGNING_KID &&
      !env.TRUSTSIGNAL_SIGNING_KEY_ID
    ) {
      required.push('TRUSTSIGNAL_RECEIPT_SIGNING_KID');
    }
  }

  if (required.length > 0) {
    throw new Error(
      `[startup] Missing required environment variables: ${required.join(', ')}. ` +
      'Set them in your .env file or deployment environment before starting the server.'
    );
  }
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const databaseUrl =
    env.DATABASE_URL ||
    env.SUPABASE_DB_URL ||
    env.SUPABASE_POOLER_URL ||
    env.SUPABASE_DIRECT_URL;

  if (databaseUrl && !env.DATABASE_URL) {
    env.DATABASE_URL = databaseUrl;
  }

  return env.DATABASE_URL;
}
