-- TrustSignal RLS policies
-- Enforces tenant-scoped row-level security on all customer-facing tables.
-- All tables holding tenant data must have RLS enabled and a SELECT/INSERT/UPDATE/DELETE
-- policy that restricts to the requesting API key's owner (user_id).
--
-- This migration is idempotent — safe to re-run.

-- ─── api_keys ─────────────────────────────────────────────────────────────────
-- Tenants may only see and rotate their own keys.

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_owner_select" ON public.api_keys;
CREATE POLICY "api_keys_owner_select"
  ON public.api_keys FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys_owner_insert" ON public.api_keys;
CREATE POLICY "api_keys_owner_insert"
  ON public.api_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys_owner_update" ON public.api_keys;
CREATE POLICY "api_keys_owner_update"
  ON public.api_keys FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys_owner_delete" ON public.api_keys;
CREATE POLICY "api_keys_owner_delete"
  ON public.api_keys FOR DELETE
  USING (user_id = auth.uid());

-- ─── tenants / customers ──────────────────────────────────────────────────────
-- Each row is isolated to the owning user. Adjust table name if different.

ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_owner_select" ON public.tenants;
CREATE POLICY "tenants_owner_select"
  ON public.tenants FOR SELECT
  USING (user_id = auth.uid());

-- ─── usage_events ─────────────────────────────────────────────────────────────
-- Tenants may only query their own usage records.

ALTER TABLE IF EXISTS public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_owner_select" ON public.usage_events;
CREATE POLICY "usage_events_owner_select"
  ON public.usage_events FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypasses RLS (used by the API server via service key).
-- Nothing to configure here — service_role bypasses RLS by default in Supabase.
