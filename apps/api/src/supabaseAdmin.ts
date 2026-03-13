type ServerOnlySupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function readEnv(name: string): string {
  return (process.env[name] || '').trim();
}

export function getServerOnlySupabaseConfig(): ServerOnlySupabaseConfig | null {
  const url =
    readEnv('SUPABASE_URL') ||
    readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_SECRET_KEY');

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export function createServerOnlySupabaseAdminClient() {
  const config = getServerOnlySupabaseConfig();
  if (!config) return null;

  return {
    url: config.url,
    /**
     * Backend-only admin client configuration.
     * The service role bypasses RLS and must never be exposed to browser or action code.
     */
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    }
  };
}
