-- TrustSignal MVP10 registry metadata seed (idempotent)
-- Scope: 5 DMV, 3 OFAC, 2 Deeds

create extension if not exists pgcrypto;

create table if not exists public.registry_adapters (
  id text primary key,
  display_name text not null,
  category text not null check (category in ('dmv', 'sanctions', 'deeds', 'license', 'notary', 'misc', 'healthcare', 'business_entity', 'public_records')),
  provider text not null,
  adapter_kind text not null,
  base_url text not null,
  zk_circuit text not null,
  enabled boolean not null default true,
  is_primary_source boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.registry_adapters
  drop constraint if exists registry_adapters_category_check;

alter table public.registry_adapters
  add constraint registry_adapters_category_check
  check (category in ('dmv', 'sanctions', 'deeds', 'license', 'notary', 'misc', 'healthcare', 'business_entity', 'public_records'));

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
  ('deeds_il_statewide', 'IL Statewide Deeds', 'deeds', 'il_state', 'http_json', 'https://www.ilsos.gov', 'title_chain_integrity', true, true),
  ('un_sc_consolidated', 'UN Security Council Consolidated List', 'sanctions', 'un_sc', 'xml', 'https://scsanctions.un.org/resources/xml/en/consolidated.xml', 'sanctions_nonmembership', true, true),
  ('uk_hmt_consolidated', 'UK HMT OFSI Consolidated List', 'sanctions', 'uk_hmt_ofsi', 'csv', 'https://ofsistorage.blob.core.windows.net/publishlive/ConList.csv', 'sanctions_nonmembership', true, true),
  ('nppes_npi_registry', 'NPPES NPI Registry', 'healthcare', 'cms', 'http_json', 'https://npiregistry.cms.hhs.gov/api', 'provider_license_status', true, true),
  ('hhs_oig_leie', 'HHS OIG LEIE', 'healthcare', 'hhs_oig', 'csv', 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv', 'provider_exclusion_nonmembership', true, true),
  ('sec_edgar_companyfacts', 'SEC EDGAR Company Facts', 'business_entity', 'sec', 'http_json', 'https://data.sec.gov/api/xbrl/companyfacts', 'entity_registration_active', true, true),
  ('de_sos_entity_search', 'Delaware Division of Corporations Entity Search', 'business_entity', 'delaware_sos', 'http_html', 'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx', 'entity_good_standing', true, true),
  ('nyc_acris', 'NYC ACRIS Public Records', 'public_records', 'nyc_dof', 'http_html', 'https://a836-acris.nyc.gov/CP/', 'record_chain_integrity', true, true),
  ('blm_glo_records', 'BLM General Land Office Records', 'public_records', 'us_blm', 'http_html', 'https://glorecords.blm.gov', 'land_record_integrity', true, true)
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
