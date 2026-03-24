// Engine-owned registry evaluation and oracle dispatch. Public gateway code
// should access registry functionality through the verification engine.
import { createHash, randomUUID } from 'node:crypto';

import type { PrismaClient, RegistrySource } from '@prisma/client';

import {
  type RegistryMatch,
  type RegistryOracleJobView,
  type RegistrySourceCategory,
  type RegistrySourceId,
  type RegistrySourceView,
  type RegistryVerifyBatchResult,
  type RegistryVerifyResult
} from '../../registry/catalog.js';

type FetchLike = typeof fetch;

type ProviderType =
  | 'csv'
  | 'sam_json'
  | 'npi_json'
  | 'sec_tickers_json'
  | 'fdic_json';

type RegistrySourceSeed = {
  id: RegistrySourceId;
  name: string;
  category: RegistrySourceCategory;
  endpointEnv: string;
  endpointDefault: string;
  zkCircuit: string;
  fetchIntervalMinutes: number;
  parserVersion: string;
  providerType: ProviderType;
  officialSourceName: string;
  primarySourceHost: string;
  requestAcceptHeader: string;
};
const SOURCE_SEEDS: RegistrySourceSeed[] = [
  {
    id: 'ofac_sdn',
    name: 'OFAC SDN',
    category: 'sanctions',
    endpointEnv: 'OFAC_SDN_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/sdn.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC SDN List',
    primarySourceHost: 'treasury.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'ofac_sls',
    name: 'OFAC SLS (Non-SDN)',
    category: 'sanctions',
    endpointEnv: 'OFAC_SLS_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/non-sdn.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC Non-SDN List',
    primarySourceHost: 'treasury.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'ofac_ssi',
    name: 'OFAC Sectoral (SSI)',
    category: 'sanctions',
    endpointEnv: 'OFAC_SSI_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/ssi.csv',
    zkCircuit: 'sectoral_restriction_match',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC SSI List',
    primarySourceHost: 'treasury.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'hhs_oig_leie',
    name: 'HHS OIG LEIE',
    category: 'sanctions',
    endpointEnv: 'OIG_LEIE_URL',
    endpointDefault: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 720,
    parserVersion: 'oig-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Health and Human Services OIG LEIE',
    primarySourceHost: 'oig.hhs.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'sam_exclusions',
    name: 'SAM Exclusions',
    category: 'sanctions',
    endpointEnv: 'SAM_EXCLUSIONS_URL',
    endpointDefault: 'https://api.sam.gov/entity-information/v2/entities',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 180,
    parserVersion: 'sam-json-v1',
    providerType: 'sam_json',
    officialSourceName: 'U.S. General Services Administration - SAM.gov',
    primarySourceHost: 'sam.gov',
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'uk_sanctions_list',
    name: 'UK Sanctions List',
    category: 'sanctions',
    endpointEnv: 'UK_SANCTIONS_CSV_URL',
    endpointDefault: 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'uk-csv-v1',
    providerType: 'csv',
    officialSourceName: 'UK Foreign, Commonwealth & Development Office - UK Sanctions List',
    primarySourceHost: 'fcdo.gov.uk',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_entity_list',
    name: 'BIS Entity List',
    category: 'sanctions',
    endpointEnv: 'BIS_ENTITY_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/entity-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Entity List',
    primarySourceHost: 'bis.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_unverified_list',
    name: 'BIS Unverified List',
    category: 'sanctions',
    endpointEnv: 'BIS_UNVERIFIED_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/unverified-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Unverified List',
    primarySourceHost: 'bis.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_military_end_user',
    name: 'BIS Military End User List',
    category: 'sanctions',
    endpointEnv: 'BIS_MEU_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/military-end-user-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Military End User List',
    primarySourceHost: 'bis.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'us_csl_consolidated',
    name: 'US Consolidated Screening List',
    category: 'sanctions',
    endpointEnv: 'US_CSL_CSV_URL',
    endpointDefault: 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'csl-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. International Trade Administration - Consolidated Screening List',
    primarySourceHost: 'trade.gov',
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'nppes_npi_registry',
    name: 'NPPES NPI Registry',
    category: 'license',
    endpointEnv: 'NPPES_NPI_API_URL',
    endpointDefault: 'https://npiregistry.cms.hhs.gov/api/',
    zkCircuit: 'license_status_nonmembership',
    fetchIntervalMinutes: 120,
    parserVersion: 'npi-json-v1',
    providerType: 'npi_json',
    officialSourceName: 'U.S. Centers for Medicare & Medicaid Services - NPPES NPI Registry',
    primarySourceHost: 'cms.hhs.gov',
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'sec_edgar_company_tickers',
    name: 'SEC EDGAR Company Tickers',
    category: 'misc',
    endpointEnv: 'SEC_EDGAR_TICKERS_URL',
    endpointDefault: 'https://www.sec.gov/files/company_tickers.json',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 1440,
    parserVersion: 'sec-edgar-json-v1',
    providerType: 'sec_tickers_json',
    officialSourceName: 'U.S. Securities and Exchange Commission - EDGAR',
    primarySourceHost: 'sec.gov',
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'fdic_bankfind_institutions',
    name: 'FDIC BankFind Institutions',
    category: 'license',
    endpointEnv: 'FDIC_BANKFIND_URL',
    endpointDefault: 'https://banks.data.fdic.gov/api/institutions',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 720,
    parserVersion: 'fdic-json-v1',
    providerType: 'fdic_json',
    officialSourceName: 'U.S. Federal Deposit Insurance Corporation - BankFind Suite',
    primarySourceHost: 'fdic.gov',
    requestAcceptHeader: 'application/json'
  }
];

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(' ').filter((part) => part.length > 0);
}

function scoreCandidate(subject: string, candidate: string): number {
  const subjectNorm = normalizeName(subject);
  const candidateNorm = normalizeName(candidate);
  if (!subjectNorm || !candidateNorm) return 0;
  if (subjectNorm === candidateNorm) return 1;
  if (candidateNorm.includes(subjectNorm) || subjectNorm.includes(candidateNorm)) return 0.9;

  const a = new Set(tokenize(subjectNorm));
  const b = new Set(tokenize(candidateNorm));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = new Set<string>([...a, ...b]).size;
  return union === 0 ? 0 : overlap / union;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

function extractCandidateNames(headers: string[], row: string[]): string[] {
  const byHeader = new Map<string, string>();
  headers.forEach((header, index) => {
    byHeader.set(header, row[index] || '');
  });

  const candidates: string[] = [];
  for (const [header, value] of byHeader.entries()) {
    if (!value) continue;
    if (/(name|entity|individual|organization|aka|alias)/.test(header)) {
      candidates.push(value);
    }
  }

  const firstName = byHeader.get('first_name') || byHeader.get('firstname') || '';
  const lastName = byHeader.get('last_name') || byHeader.get('lastname') || '';
  if (firstName || lastName) {
    candidates.push(`${firstName} ${lastName}`.trim());
  }

  if (candidates.length === 0 && row.length > 0) {
    candidates.push(row[0]);
  }

  return [...new Set(candidates.map((value) => value.trim()).filter(Boolean))];
}

function sourceEndpoint(seed: RegistrySourceSeed, env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env[seed.endpointEnv] || '').trim();
  return configured || seed.endpointDefault;
}

function subjectHash(sourceId: RegistrySourceId, subject: string): string {
  return createHash('sha256')
    .update(`${sourceId}:${normalizeName(subject)}`)
    .digest('hex');
}

function inputCommitment(sourceId: RegistrySourceId, subject: string, response: Omit<RegistryVerifyResult, 'cached'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceId,
        subject: normalizeName(subject),
        status: response.status,
        matches: response.matches,
        checkedAt: response.checkedAt,
        sourceVersion: response.sourceVersion
      })
    )
    .digest('hex');
}

const SOURCE_SEED_BY_ID = new Map<RegistrySourceId, RegistrySourceSeed>(
  SOURCE_SEEDS.map((seed) => [seed.id, seed])
);

function resolveRegistryUserAgent(): string {
  return (process.env.REGISTRY_USER_AGENT || '').trim() || 'TrustSignal-RegistryAdapter/1.0 (compliance@trustsignal.dev)';
}

function resolveTimeoutMs(): number {
  const parsed = Number.parseInt((process.env.REGISTRY_FETCH_TIMEOUT_MS || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return 15000;
  return Math.min(parsed, 60000);
}

function resolveProviderCooldownMs(): number {
  const parsed = Number.parseInt((process.env.REGISTRY_PROVIDER_COOLDOWN_MS || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 300;
  return Math.min(parsed, 5000);
}

const providerLastCallAt = new Map<string, number>();

async function applyProviderCooldown(providerKey: string): Promise<void> {
  const minIntervalMs = resolveProviderCooldownMs();
  if (minIntervalMs <= 0) return;
  const now = Date.now();
  const last = providerLastCallAt.get(providerKey) || 0;
  const waitMs = minIntervalMs - (now - last);
  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  providerLastCallAt.set(providerKey, Date.now());
}

function validatePrimarySourceEndpoint(seed: RegistrySourceSeed, endpoint: string): { ok: true } | { ok: false; details: string } {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    if (host === seed.primarySourceHost || host.endsWith(`.${seed.primarySourceHost}`)) {
      return { ok: true };
    }
    return {
      ok: false,
      details: `endpoint host ${host} is not an approved primary source for ${seed.id}`
    };
  } catch {
    return {
      ok: false,
      details: `invalid endpoint URL configured for ${seed.id}`
    };
  }
}

async function secureFetch(
  url: string,
  options: {
    accept: string;
    method?: string;
    body?: string;
    contentType?: string;
  },
  fetchImpl: FetchLike
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: options.accept,
    'user-agent': resolveRegistryUserAgent()
  };

  if (options.contentType) {
    headers['content-type'] = options.contentType;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveTimeoutMs());
  try {
    return await fetchImpl(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCsvMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  await applyProviderCooldown(source.id);
  const response = await secureFetch(endpoint, { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }
  const csv = await response.text();
  const { headers, rows } = parseCsv(csv);

  const matchMap = new Map<string, number>();
  for (const row of rows) {
    const names = extractCandidateNames(headers, row);
    for (const name of names) {
      const score = scoreCandidate(subject, name);
      if (score >= 0.7) {
        const current = matchMap.get(name) || 0;
        if (score > current) {
          matchMap.set(name, score);
        }
      }
    }
  }

  const matches = [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches, sourceVersion };
}

async function fetchSamMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const apiKey = (process.env.SAM_API_KEY || '').trim();
  if (!apiKey) {
    return { matches: [], sourceVersion: null };
  }

  const url = new URL(endpoint);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('legalBusinessName', subject);
  url.searchParams.set('includeSections', 'entityRegistration,exclusions');
  url.searchParams.set('page', '0');
  url.searchParams.set('size', '10');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const sources = ['entityData', 'entities', 'results'] as const;
  const entities: Array<Record<string, unknown>> = [];
  for (const key of sources) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === 'object') {
          entities.push(entry as Record<string, unknown>);
        }
      }
    }
  }

  const matchMap = new Map<string, number>();
  for (const entity of entities) {
    const nameCandidates = [
      entity.legalBusinessName,
      entity.entityName,
      entity.entityRegistrationName
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    for (const name of nameCandidates) {
      const score = scoreCandidate(subject, name);
      if (score >= 0.7) {
        const current = matchMap.get(name) || 0;
        if (score > current) matchMap.set(name, score);
      }
    }
  }

  const matches = [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches, sourceVersion };
}

async function fetchNpiMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  url.searchParams.set('version', '2.1');
  url.searchParams.set('organization_name', subject);
  url.searchParams.set('limit', '25');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const results = Array.isArray(payload.results) ? payload.results : [];
  const matchMap = new Map<string, number>();

  for (const entry of results) {
    if (!entry || typeof entry !== 'object') continue;
    const asRecord = entry as Record<string, unknown>;
    const basic = (asRecord.basic && typeof asRecord.basic === 'object')
      ? (asRecord.basic as Record<string, unknown>)
      : null;
    const names = [
      typeof basic?.organization_name === 'string' ? basic.organization_name : '',
      `${typeof basic?.first_name === 'string' ? basic.first_name : ''} ${
        typeof basic?.last_name === 'string' ? basic.last_name : ''
      }`.trim()
    ].filter((value) => value.trim().length > 0);

    for (const name of names) {
      const score = scoreCandidate(subject, name);
      if (score >= 0.7) {
        const current = matchMap.get(name) || 0;
        if (score > current) matchMap.set(name, score);
      }
    }
  }

  const matches = [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches, sourceVersion };
}

async function fetchSecTickerMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  await applyProviderCooldown(source.id);
  const response = await secureFetch(endpoint, { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const matchMap = new Map<string, number>();
  for (const value of Object.values(payload)) {
    if (!value || typeof value !== 'object') continue;
    const company = value as Record<string, unknown>;
    const title = typeof company.title === 'string' ? company.title : '';
    const ticker = typeof company.ticker === 'string' ? company.ticker : '';
    const candidates = [title, ticker].filter((item) => item.length > 0);
    for (const candidate of candidates) {
      const score = scoreCandidate(subject, candidate);
      if (score >= 0.7) {
        const current = matchMap.get(candidate) || 0;
        if (score > current) matchMap.set(candidate, score);
      }
    }
  }

  const matches = [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches, sourceVersion };
}

async function fetchFdicMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  const firstToken = tokenize(subject)[0] || subject;
  url.searchParams.set('filters', `NAME:${firstToken.toUpperCase()}*`);
  url.searchParams.set('limit', '50');
  url.searchParams.set('format', 'json');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  const matchMap = new Map<string, number>();
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const details = (row as Record<string, unknown>).data;
    if (!details || typeof details !== 'object') continue;
    const name = (details as Record<string, unknown>).NAME;
    if (typeof name !== 'string' || name.trim().length === 0) continue;
    const score = scoreCandidate(subject, name);
    if (score >= 0.7) {
      const current = matchMap.get(name) || 0;
      if (score > current) matchMap.set(name, score);
    }
  }

  const matches = [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches, sourceVersion };
}

async function syncRegistrySources(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  for (const seed of SOURCE_SEEDS) {
    await prisma.registrySource.upsert({
      where: { id: seed.id },
      update: {
        name: seed.officialSourceName,
        category: seed.category,
        endpoint: sourceEndpoint(seed, env),
        zkCircuit: seed.zkCircuit,
        active: true,
        freeTier: true,
        fetchIntervalMinutes: seed.fetchIntervalMinutes,
        parserVersion: seed.parserVersion
      },
      create: {
        id: seed.id,
        name: seed.officialSourceName,
        category: seed.category,
        endpoint: sourceEndpoint(seed, env),
        zkCircuit: seed.zkCircuit,
        active: true,
        freeTier: true,
        fetchIntervalMinutes: seed.fetchIntervalMinutes,
        parserVersion: seed.parserVersion
      }
    });
  }
}

async function runLookup(
  source: RegistrySource,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ status: RegistryVerifyResult['status']; matches: RegistryMatch[]; sourceVersion: string | null; details?: string }> {
  const seed = SOURCE_SEED_BY_ID.get(source.id as RegistrySourceId);
  if (!seed) {
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details: `source ${source.id} is not in the primary-source registry catalog`
    };
  }

  const primaryEndpoint = validatePrimarySourceEndpoint(seed, source.endpoint);
  if (!primaryEndpoint.ok) {
    const { details } = primaryEndpoint;
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details
    };
  }

  try {
    if (seed.providerType === 'sam_json') {
      if (!(process.env.SAM_API_KEY || '').trim()) {
        return {
          status: 'COMPLIANCE_GAP',
          matches: [],
          sourceVersion: null,
          details: 'SAM_API_KEY is not configured for SAM.gov primary source calls'
        };
      }
      const result = await fetchSamMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'npi_json') {
      const result = await fetchNpiMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'sec_tickers_json') {
      const result = await fetchSecTickerMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'fdic_json') {
      const result = await fetchFdicMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    const result = await fetchCsvMatches(seed, source.endpoint, subject, fetchImpl);
    return {
      status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
      matches: result.matches,
      sourceVersion: result.sourceVersion
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message.slice(0, 200) : 'primary_source_lookup_failed';
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details: `primary source lookup failed: ${message}`
    };
  }
}

async function dispatchOracleJob(
  job: {
    id: string;
    sourceId: string;
    zkCircuit: string;
    inputCommitment: string;
  },
  fetchImpl: FetchLike
): Promise<{ status: string; proofUri?: string; error?: string }> {
  const endpoint = (process.env.ZK_ORACLE_URL || '').trim();
  if (!endpoint) {
    return { status: 'SKIPPED' };
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jobId: job.id,
        sourceId: job.sourceId,
        circuit: job.zkCircuit,
        inputCommitment: job.inputCommitment
      })
    });

    if (!response.ok) {
      return { status: 'FAILED', error: `oracle_http_${response.status}` };
    }

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const proofUri = typeof payload.proofUri === 'string' ? payload.proofUri : undefined;
    return { status: 'DISPATCHED', proofUri };
  } catch {
    return { status: 'FAILED', error: 'oracle_dispatch_failed' };
  }
}

export function createRegistryAdapterService(
  prisma: PrismaClient,
  options?: { fetchImpl?: FetchLike }
) {
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    async listSources() {
      await syncRegistrySources(prisma);
      const sources = await prisma.registrySource.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] });
      return sources.map((source): RegistrySourceView => ({
        id: source.id,
        name: source.name,
        category: source.category,
        endpoint: source.endpoint,
        zkCircuit: source.zkCircuit,
        active: source.active,
        freeTier: source.freeTier,
        fetchIntervalMinutes: source.fetchIntervalMinutes,
        parserVersion: source.parserVersion,
        lastFetchedAt: source.lastFetchedAt,
        lastSuccessAt: source.lastSuccessAt,
        lastError: source.lastError
      }));
    },

    async verify(input: { sourceId: RegistrySourceId; subject: string; forceRefresh?: boolean }): Promise<RegistryVerifyResult> {
      await syncRegistrySources(prisma);

      const source = await prisma.registrySource.findUnique({ where: { id: input.sourceId } });
      if (!source || !source.active) {
        throw new Error('registry_source_not_found');
      }

      const now = new Date();
      const key = subjectHash(input.sourceId, input.subject);
      if (!input.forceRefresh) {
        const cached = await prisma.registryCache.findUnique({
          where: {
            sourceId_subjectHash: {
              sourceId: input.sourceId,
              subjectHash: key
            }
          }
        });

        if (cached && cached.expiresAt > now) {
          const parsed = JSON.parse(cached.responseJson) as Omit<RegistryVerifyResult, 'cached'>;
          return { ...parsed, cached: true };
        }
      }

      const lookup = await runLookup(source, input.subject, fetchImpl);
      const checkedAt = new Date();
      const response: Omit<RegistryVerifyResult, 'cached'> = {
        sourceId: input.sourceId,
        sourceName: source.name,
        category: source.category as RegistrySourceCategory,
        zkCircuit: source.zkCircuit,
        subject: input.subject,
        status: lookup.status,
        matched: lookup.matches.length > 0,
        matches: lookup.matches,
        checkedAt: checkedAt.toISOString(),
        sourceVersion: lookup.sourceVersion,
        details: lookup.details
      };

      const commitment = inputCommitment(input.sourceId, input.subject, response);
      const job = await prisma.registryOracleJob.create({
        data: {
          sourceId: input.sourceId,
          subjectHash: key,
          zkCircuit: source.zkCircuit,
          inputCommitment: commitment,
          status: 'QUEUED',
          resultStatus: response.status
        }
      });

      const dispatch = await dispatchOracleJob(
        {
          id: job.id,
          sourceId: input.sourceId,
          zkCircuit: source.zkCircuit,
          inputCommitment: commitment
        },
        fetchImpl
      );

      await prisma.registryOracleJob.update({
        where: { id: job.id },
        data: {
          status: dispatch.status,
          proofUri: dispatch.proofUri || null,
          error: dispatch.error || null,
          completedAt: dispatch.status === 'DISPATCHED' ? null : checkedAt
        }
      });

      const expiresAt = new Date(checkedAt.getTime() + source.fetchIntervalMinutes * 60 * 1000);
      await prisma.registryCache.upsert({
        where: {
          sourceId_subjectHash: {
            sourceId: input.sourceId,
            subjectHash: key
          }
        },
        update: {
          responseJson: JSON.stringify(response),
          status: response.status,
          fetchedAt: checkedAt,
          expiresAt,
          sourceVersion: response.sourceVersion || undefined
        },
        create: {
          id: randomUUID(),
          sourceId: input.sourceId,
          subjectHash: key,
          responseJson: JSON.stringify(response),
          status: response.status,
          fetchedAt: checkedAt,
          expiresAt,
          sourceVersion: response.sourceVersion || undefined
        }
      });

      await prisma.registrySource.update({
        where: { id: source.id },
        data: {
          lastFetchedAt: checkedAt,
          lastSuccessAt: response.status === 'COMPLIANCE_GAP' ? source.lastSuccessAt : checkedAt,
          lastError: response.status === 'COMPLIANCE_GAP' ? (response.details || 'compliance_gap') : null
        }
      });

      return { ...response, cached: false };
    },

    async verifyBatch(input: {
      sourceIds: RegistrySourceId[];
      subject: string;
      forceRefresh?: boolean;
    }): Promise<RegistryVerifyBatchResult> {
      const uniqueSources = [...new Set(input.sourceIds)];
      const results: RegistryVerifyResult[] = [];
      for (const sourceId of uniqueSources) {
        const result = await this.verify({
          sourceId,
          subject: input.subject,
          forceRefresh: input.forceRefresh
        });
        results.push(result);
      }
      return {
        subject: input.subject,
        generatedAt: new Date().toISOString(),
        summary: {
          totalSources: results.length,
          matchedSources: results.filter((item) => item.matched).length,
          complianceGapSources: results.filter((item) => item.status === 'COMPLIANCE_GAP').length
        },
        results
      };
    },

    async getOracleJob(jobId: string): Promise<RegistryOracleJobView | null> {
      const job = await prisma.registryOracleJob.findUnique({
        where: { id: jobId }
      });

      if (!job) return null;
      return {
        id: job.id,
        sourceId: job.sourceId,
        zkCircuit: job.zkCircuit,
        status: job.status,
        resultStatus: job.resultStatus,
        proofUri: job.proofUri,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : null
      };
    },

    async listOracleJobs(limit = 50): Promise<RegistryOracleJobView[]> {
      const jobs = await prisma.registryOracleJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(limit, 200))
      });

      return jobs.map((job) => ({
        id: job.id,
        sourceId: job.sourceId,
        zkCircuit: job.zkCircuit,
        status: job.status,
        resultStatus: job.resultStatus,
        proofUri: job.proofUri,
        error: job.error,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : null
      }));
    }
  };
}
