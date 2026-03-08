import 'dotenv/config';

import { defineConfig } from 'prisma/config';

function resolveDirectDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const candidates = [
    env.DIRECT_URL,
    env.SUPABASE_DIRECT_URL,
    env.DATABASE_URL,
    env.SUPABASE_DB_URL,
    env.SUPABASE_POOLER_URL
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: resolveDirectDatabaseUrl() ?? ''
  }
});
