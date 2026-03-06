-- TrustSignal MVP10 registry metadata seed (idempotent)
-- Scope: 5 DMV, 3 OFAC, 2 Deeds

create extension if not exists pgcrypto;

create table if not exists public.registry_adapters (
  id text primary key,
  display_name text not null,
  category text not null check (category in ('dmv', 'sanctions', 'deeds', 'license', 'notary', 'misc')),
  provider text not null,
  adapter_kind text not null,
  base_url text not null,
  zk_circuit text not null,
  enabled boolean not null default true,
  is_primary_source boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.registry_adapters (id, display_name, category, provider, adapter_kind, base_url, zk_circuit, enabled, is_primary_source)
values
  ('dmv_ca_idscan', 'CA DMV (via IDScan)', 'dmv', 'idscan', 'http_json', 'https://api.idscan.net/v1', 'id_validity', true, false),
  ('dmv_ny_idscan', 'NY DMV (via IDScan)', 'dmv', 'idscan', 'http_json', 'https://api.idscan.net/v1', 'id_validity', true, false),
  ('dmv_tx_idscan', 'TX DMV (via IDScan)', 'dmv', 'idscan', 'http_json', 'https://api.idscan.net/v1', 'id_validity', true, false),
  ('dmv_fl_idscan', 'FL DMV (via IDScan)', 'dmv', 'idscan', 'http_json', 'https://api.idscan.net/v1', 'id_validity', true, false),
  ('dmv_il_idscan', 'IL DMV (via IDScan)', 'dmv', 'idscan', 'http_json', 'https://api.idscan.net/v1', 'id_validity', true, false),
  ('ofac_sdn', 'OFAC SDN', 'sanctions', 'us_treasury', 'csv', 'https://www.treasury.gov/ofac/downloads/sdn.csv', 'sanctions_nonmembership', true, true),
  ('ofac_sls', 'OFAC SLS', 'sanctions', 'us_treasury', 'csv', 'https://www.treasury.gov/ofac/downloads/non-sdn.csv', 'sanctions_nonmembership', true, true),
  ('ofac_ssi', 'OFAC SSI', 'sanctions', 'us_treasury', 'csv', 'https://www.treasury.gov/ofac/downloads/ssi.csv', 'sectoral_restriction_match', true, true),
  ('deeds_nmvtis', 'NMVTIS', 'deeds', 'us_doj', 'http_json', 'https://vehiclehistory.bja.ojp.gov/nmvtis', 'title_chain_integrity', true, true),
  ('deeds_il_statewide', 'IL Statewide Deeds', 'deeds', 'il_state', 'http_json', 'https://www.ilsos.gov', 'title_chain_integrity', true, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  provider = excluded.provider,
  adapter_kind = excluded.adapter_kind,
  base_url = excluded.base_url,
  zk_circuit = excluded.zk_circuit,
  enabled = excluded.enabled,
  is_primary_source = excluded.is_primary_source,
  updated_at = now();
