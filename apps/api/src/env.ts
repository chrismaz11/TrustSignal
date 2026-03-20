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
