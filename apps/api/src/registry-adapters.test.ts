import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from './server.js';

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

const describeWithDatabase = process.env.DATABASE_URL ? describe.sequential : describe.skip;

describeWithDatabase('Registry adapters: free source wiring', () => {
  let app: FastifyInstance;
  let envSnapshot: EnvSnapshot;
  let fetchCalls = 0;

  const mockFetch: typeof fetch = async (input) => {
    fetchCalls += 1;
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('sdn.csv')) {
      return new Response(
        [
          'name,program',
          'ACME HOLDINGS LLC,SDN',
          'OTHER ENTITY,SDN'
        ].join('\n'),
        { status: 200, headers: { ETag: 'sdn-v1' } }
      );
    }

    if (url.includes('non-sdn.csv')) {
      return new Response(
        [
          'name,program',
          'BLUE SKY IMPORTS,NON-SDN'
        ].join('\n'),
        { status: 200, headers: { ETag: 'sls-v1' } }
      );
    }

    if (url.includes('ssi.csv')) {
      return new Response(
        [
          'name,program',
          'GLOBAL SHIPPING PLC,SSI'
        ].join('\n'),
        { status: 200, headers: { ETag: 'ssi-v1' } }
      );
    }

    if (url.includes('UPDATED.csv')) {
      return new Response(
        [
          'first_name,last_name',
          'Acme,Holdings'
        ].join('\n'),
        { status: 200, headers: { ETag: 'oig-v1' } }
      );
    }

    if (url.includes('NfipCommunityLayerComprehensive')) {
      return new Response(
        JSON.stringify({
          NfipCommunityLayerComprehensive: [
            {
              COMMUNITY_NAME: 'Chicago',
              COUNTY: 'Cook County',
              STATE: 'IL',
              COMMUNITY_NUMBER: '170074'
            }
          ]
        }),
        { status: 200, headers: { ETag: 'openfema-v1' } }
      );
    }

    if (url.includes('api.gleif.org/api/v1/lei-records')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              attributes: {
                lei: '1234567890ABCDE12345',
                entity: {
                  legalName: { name: 'Acme Holdings LLC' },
                  otherNames: [{ name: 'ACME HOLDINGS' }]
                }
              }
            }
          ]
        }),
        { status: 200, headers: { ETag: 'gleif-v1' } }
      );
    }

    return new Response('{}', { status: 200, headers: { ETag: 'default-v1' } });
  };

  beforeAll(async () => {
    envSnapshot = snapshotEnv([
      'API_KEYS',
      'API_KEY_SCOPES',
      'RATE_LIMIT_GLOBAL_MAX',
      'RATE_LIMIT_API_KEY_MAX',
      'RATE_LIMIT_WINDOW',
      'SAM_API_KEY'
    ]);

    process.env.API_KEYS = 'test-read,test-verify';
    process.env.API_KEY_SCOPES = 'test-read=read;test-verify=read|verify|anchor|revoke';
    process.env.RATE_LIMIT_GLOBAL_MAX = '200';
    process.env.RATE_LIMIT_API_KEY_MAX = '100';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    delete process.env.SAM_API_KEY;

    app = await buildServer({ fetchImpl: mockFetch });
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(envSnapshot);
  });

  it('lists free registry sources', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/registry/sources',
      headers: { 'x-api-key': 'test-read' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { sources: Array<{ id: string }> };
    const ids = body.sources.map((source) => source.id);
    expect(ids).toContain('ofac_sdn');
    expect(ids).toContain('ofac_sls');
    expect(ids).toContain('ofac_ssi');
    expect(ids).toContain('hhs_oig_leie');
    expect(ids).toContain('sam_exclusions');
    expect(ids).toContain('uk_sanctions_list');
    expect(ids).toContain('bis_entity_list');
    expect(ids).toContain('us_csl_consolidated');
    expect(ids).toContain('nppes_npi_registry');
    expect(ids).toContain('sec_edgar_company_tickers');
    expect(ids).toContain('fdic_bankfind_institutions');
    expect(ids).toContain('openfema_nfip_community');
    expect(ids).toContain('gleif_lei_records');
  });

  it('verifies against OFAC and uses cache on repeated lookups', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceId: 'ofac_sdn',
        subjectName: 'Acme Holdings LLC'
      }
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as { status: string; matched: boolean; cached: boolean; matches: Array<{ name: string }> };
    expect(firstBody.status).toBe('MATCH');
    expect(firstBody.matched).toBe(true);
    expect(firstBody.cached).toBe(false);
    expect(firstBody.matches[0]?.name).toContain('ACME');

    const callsAfterFirst = fetchCalls;

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceId: 'ofac_sdn',
        subjectName: 'Acme Holdings LLC'
      }
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as { cached: boolean; status: string };
    expect(secondBody.cached).toBe(true);
    expect(secondBody.status).toBe('MATCH');
    expect(fetchCalls).toBe(callsAfterFirst);
  });

  it('returns compliance gap for SAM when API key is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceId: 'sam_exclusions',
        subjectName: 'ACME HOLDINGS'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; matched: boolean; details?: string };
    expect(body.status).toBe('COMPLIANCE_GAP');
    expect(body.matched).toBe(false);
    expect(body.details).toContain('SAM_API_KEY');
  });

  it('supports OpenFEMA and GLEIF primary-source adapters', async () => {
    const openFemaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceId: 'openfema_nfip_community',
        subjectName: 'Cook County'
      }
    });

    expect(openFemaRes.statusCode).toBe(200);
    const openFemaBody = openFemaRes.json() as { status: string; matched: boolean; sourceName: string };
    expect(openFemaBody.status).toBe('MATCH');
    expect(openFemaBody.matched).toBe(true);
    expect(openFemaBody.sourceName).toContain('Federal Emergency Management Agency');

    const gleifRes = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceId: 'gleif_lei_records',
        subjectName: 'Acme Holdings LLC'
      }
    });

    expect(gleifRes.statusCode).toBe(200);
    const gleifBody = gleifRes.json() as { status: string; matched: boolean; sourceName: string };
    expect(gleifBody.status).toBe('MATCH');
    expect(gleifBody.matched).toBe(true);
    expect(gleifBody.sourceName).toContain('Global Legal Entity Identifier Foundation');
  });

  it('supports batch verify and oracle job listing', async () => {
    const batch = await app.inject({
      method: 'POST',
      url: '/api/v1/registry/verify-batch',
      headers: { 'x-api-key': 'test-verify' },
      payload: {
        sourceIds: ['ofac_sdn', 'hhs_oig_leie'],
        subjectName: 'Acme Holdings LLC'
      }
    });

    expect(batch.statusCode).toBe(200);
    const batchBody = batch.json() as { summary: { totalSources: number }; results: Array<{ sourceId: string }> };
    expect(batchBody.summary.totalSources).toBe(2);
    expect(batchBody.results.map((item) => item.sourceId).sort()).toEqual(['hhs_oig_leie', 'ofac_sdn']);

    const jobsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/registry/jobs?limit=5',
      headers: { 'x-api-key': 'test-read' }
    });
    expect(jobsRes.statusCode).toBe(200);
    const jobsBody = jobsRes.json() as { jobs: Array<{ id: string }> };
    expect(jobsBody.jobs.length).toBeGreaterThan(0);

    const firstJobId = jobsBody.jobs[0]?.id;
    expect(firstJobId).toBeTruthy();

    const jobRes = await app.inject({
      method: 'GET',
      url: `/api/v1/registry/jobs/${firstJobId}`,
      headers: { 'x-api-key': 'test-read' }
    });
    expect(jobRes.statusCode).toBe(200);
    expect(jobRes.json().id).toBe(firstJobId);
  });
});
