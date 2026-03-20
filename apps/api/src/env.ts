import { readFileSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

let envLoaded = false;

export function loadRuntimeEnv(envPathCandidates?: string[]): void {
  if (envLoaded) return;

  const candidates =
    envPathCandidates ??
    [
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../../.env.local'),
      path.resolve(process.cwd(), '../../.env')
    ];

  for (const envPath of candidates) {
    dotenv.config({ path: envPath, override: false });
  }

  envLoaded = true;
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const direct = (env.DATABASE_URL || '').trim();
  if (direct) return direct;

  const candidates = [env.SUPABASE_DB_URL, env.SUPABASE_POOLER_URL, env.SUPABASE_DIRECT_URL];

  for (const candidate of candidates) {
    const value = (candidate || '').trim();
    if (value) {
      env.DATABASE_URL = value;
      return value;
    }
  }

  const supabasePassword = (env.SUPABASE_DB_PASSWORD || '').trim();
  if (supabasePassword) {
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
        // Continue searching candidate pooler URLs.
      }
    }
  }

  return null;
}
