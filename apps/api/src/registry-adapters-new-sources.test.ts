import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { __testables, type RegistrySourceId } from './services/registryAdapters.js';

type FakeJob = {
  id: string;
  sourceId: string;
  jobType: string;
  status: string;
  snapshotCapturedAt: Date | null;
  snapshotSourceVersion: string | null;
  error?: string | null;
};

function createFakePrisma() {
  const jobs: FakeJob[] = [];
  return {
    jobs,
    prisma: {
      registryOracleJob: {
        async create({ data }: { data: Record<string, unknown> }) {
          const job: FakeJob = {
            id: `job-${jobs.length + 1}`,
            sourceId: String(data.sourceId),
            jobType: String(data.jobType),
            status: String(data.status),
            snapshotCapturedAt: null,
            snapshotSourceVersion: null
          };
          jobs.push(job);
          return job;
        },
        async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
          const job = jobs.find((entry) => entry.id === where.id);
          if (!job) throw new Error(`job_not_found:${where.id}`);
          if (typeof data.status === 'string') job.status = data.status;
          if ('snapshotCapturedAt' in data) {
            job.snapshotCapturedAt = data.snapshotCapturedAt as Date | null;
          }
          if ('snapshotSourceVersion' in data) {
            job.snapshotSourceVersion = data.snapshotSourceVersion as string | null;
          }
          if ('error' in data) {
            job.error = (data.error as string | null) || null;
          }
          return job;
        }
      },
      registrySource: {
        async update() {
          return null;
        }
      }
    }
  };
}

type SourceFixture = {
  sourceId: RegistrySourceId;
  subject: string;
  matchBody: string;
  noMatchBody: string;
  malformedBody: string;
  contentType?: string;
  env?: Record<string, string>;
};

const FIXTURES: SourceFixture[] = [
  {
    sourceId: 'un_consolidated_sanctions',
    subject: 'Acme Holdings LLC',
    matchBody: '<root><entry><name>Acme Holdings LLC</name></entry></root>',
    noMatchBody: '<root><entry><name>Other Entity LLC</name></entry></root>',
    malformedBody: '<root></root>',
    contentType: 'application/xml'
  },
  {
    sourceId: 'state_dept_debarred',
    subject: 'Acme Holdings LLC',
    matchBody: '<root><party><name>Acme Holdings LLC</name></party></root>',
    noMatchBody: '<root><party><name>Other Defense Corp</name></party></root>',
    malformedBody: '<root></root>',
    contentType: 'application/xml'
  },
  {
    sourceId: 'state_dept_nonproliferation',
    subject: 'Acme Holdings LLC',
    matchBody: '<html><body><table><tr><td>Acme Holdings LLC</td></tr></table></body></html>',
    noMatchBody: '<html><body><table><tr><td>Other Export Corp</td></tr></table></body></html>',
    malformedBody: '<html><body></body></html>',
    contentType: 'text/html'
  },
  {
    sourceId: 'ncua_credit_unions',
    subject: 'Acme Credit Union',
    matchBody: '{"results":[{"name":"Acme Credit Union"}]}',
    noMatchBody: '{"results":[{"name":"Other Credit Union"}]}',
    malformedBody: 'not-json',
    contentType: 'application/json'
  },
  {
    sourceId: 'finra_brokercheck',
    subject: 'Acme Securities LLC',
    matchBody: '{"results":[{"brokerName":"Acme Securities LLC"}]}',
    noMatchBody: '{"results":[{"brokerName":"Other Securities LLC"}]}',
    malformedBody: 'not-json',
    contentType: 'application/json',
    env: { FINRA_BROKERCHECK_API_KEY: 'test-finra-key' }
  },
  {
    sourceId: 'fincen_msb',
    subject: 'Acme Money Services',
    matchBody: 'name\nAcme Money Services',
    noMatchBody: 'name\nOther MSB',
    malformedBody: 'name',
    contentType: 'text/csv'
  },
  {
    sourceId: 'ffiec_nic',
    subject: 'Acme Bancorp',
    matchBody: '<root><holding><name>Acme Bancorp</name></holding></root>',
    noMatchBody: '<root><holding><name>Other Bancorp</name></holding></root>',
    malformedBody: '<root></root>',
    contentType: 'application/xml'
  },
  {
    sourceId: 'gleif_lei',
    subject: 'Acme Global LLC',
    matchBody: '{"data":[{"attributes":{"entity":{"legalName":{"name":"Acme Global LLC"}}}}]}',
    noMatchBody: '{"data":[{"attributes":{"entity":{"legalName":{"name":"Other Global LLC"}}}}]}',
    malformedBody: 'not-json',
    contentType: 'application/json'
  },
  {
    sourceId: 'cms_medicare_optout',
    subject: 'Acme Medical Group',
    matchBody: 'name\nAcme Medical Group',
    noMatchBody: 'name\nOther Medical Group',
    malformedBody: 'name',
    contentType: 'text/csv'
  },
  {
    sourceId: 'irs_teos',
    subject: 'Acme Foundation',
    matchBody: 'name\nAcme Foundation',
    noMatchBody: 'name\nOther Foundation',
    malformedBody: 'name',
    contentType: 'text/csv'
  },
  {
    sourceId: 'nyc_acris',
    subject: 'Acme Holdings LLC',
    matchBody: '[{"party_name":"Acme Holdings LLC"}]',
    noMatchBody: '[{"party_name":"Other Holdings LLC"}]',
    malformedBody: '{"oops":true}',
    contentType: 'application/json'
  },
  {
    sourceId: 'canada_sema_sanctions',
    subject: 'Acme Holdings LLC',
    matchBody: '<root><entry><name>Acme Holdings LLC</name></entry></root>',
    noMatchBody: '<root><entry><name>Other Entity Ltd</name></entry></root>',
    malformedBody: '<root></root>',
    contentType: 'application/xml'
  },
  {
    sourceId: 'canada_fintrac_msb',
    subject: 'Acme Money Services',
    matchBody: '<html><body><table><tr><td>Acme Money Services</td></tr></table></body></html>',
    noMatchBody: '<html><body><table><tr><td>Other Money Services</td></tr></table></body></html>',
    malformedBody: '<html><body></body></html>',
    contentType: 'text/html'
  },
  {
    sourceId: 'canada_cra_charities',
    subject: 'Acme Charity',
    matchBody: '{"results":[{"charityName":"Acme Charity"}]}',
    noMatchBody: '{"results":[{"charityName":"Other Charity"}]}',
    malformedBody: 'not-json',
    contentType: 'application/json'
  },
  {
    sourceId: 'canada_osfi_fri',
    subject: 'Acme Bank',
    matchBody: '<html><body><table><tr><td>Acme Bank</td></tr></table></body></html>',
    noMatchBody: '<html><body><table><tr><td>Other Bank</td></tr></table></body></html>',
    malformedBody: '<html><body></body></html>',
    contentType: 'text/html'
  },
  {
    sourceId: 'pacer_federal_courts',
    subject: 'Acme Holdings LLC',
    matchBody: '<html><body><table><tr><td>Acme Holdings LLC</td></tr></table></body></html>',
    noMatchBody: '<html><body><table><tr><td>Other Holdings LLC</td></tr></table></body></html>',
    malformedBody: '<html><body></body></html>',
    contentType: 'text/html',
    env: { PACER_API_TOKEN: 'test-pacer-token' }
  },
  {
    sourceId: 'canada_bc_registry',
    subject: 'Acme Industries Ltd',
    matchBody: '{"results":[{"businessName":"Acme Industries Ltd"}]}',
    noMatchBody: '{"results":[{"businessName":"Other Industries Ltd"}]}',
    malformedBody: 'not-json',
    contentType: 'application/json'
  },
  {
    sourceId: 'canada_corporations_canada',
    subject: 'Acme Industries Ltd',
    matchBody: '<html><body><table><tr><td>Acme Industries Ltd</td></tr></table></body></html>',
    noMatchBody: '<html><body><table><tr><td>Other Industries Ltd</td></tr></table></body></html>',
    malformedBody: '<html><body></body></html>',
    contentType: 'text/html'
  }
];

const tempDirs: string[] = [];

afterEach(async () => {
  __testables.resetProviderCooldowns();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('Registry adapters: new source fail-closed behavior', () => {
  for (const fixture of FIXTURES) {
    describe(fixture.sourceId, () => {
      async function execute(body: string, status = 200) {
        const { prisma, jobs } = createFakePrisma();
        const snapshotDir = await mkdtemp(path.join(os.tmpdir(), 'registry-adapter-test-'));
        tempDirs.push(snapshotDir);

        const fetchImpl: typeof fetch = async () =>
          new Response(body, {
            status,
            headers: {
              'content-type': fixture.contentType || 'application/json',
              etag: `${fixture.sourceId}-v1`
            }
          });

        const result = await __testables.lookupSourceById({
          prisma: prisma as never,
          sourceId: fixture.sourceId,
          subject: fixture.subject,
          fetchImpl,
          env: { ...process.env, ...(fixture.env || {}) },
          snapshotDir
        });

        return { result, jobs };
      }

      it('returns MATCH when the official source contains the subject', async () => {
        const { result } = await execute(fixture.matchBody);
        expect(result.status).toBe('MATCH');
        expect(result.matches[0]?.name).toContain(fixture.subject.split(' ')[0] || fixture.subject);
      });

      it('returns NO_MATCH when the official source does not contain the subject', async () => {
        const { result } = await execute(fixture.noMatchBody);
        expect(result.status).toBe('NO_MATCH');
        expect(result.matches).toHaveLength(0);
      });

      it('returns COMPLIANCE_GAP on fetch failure', async () => {
        const { result } = await execute('unavailable', 503);
        expect(result.status).toBe('COMPLIANCE_GAP');
        expect(result.details).toContain('upstream_http_503');
      });

      it('returns COMPLIANCE_GAP on malformed upstream data', async () => {
        const { result } = await execute(fixture.malformedBody);
        expect(result.status).toBe('COMPLIANCE_GAP');
      });

      if (
        fixture.sourceId === 'un_consolidated_sanctions' ||
        fixture.sourceId === 'fincen_msb' ||
        fixture.sourceId === 'irs_teos'
      ) {
        it('creates an ingest job and records snapshot metadata for snapshot-backed sources', async () => {
          const { result, jobs } = await execute(fixture.matchBody);
          expect(result.snapshotCapturedAt).toBeTruthy();
          expect(jobs.some((job) => job.jobType === 'INGEST')).toBe(true);
          const ingestJob = jobs.find((job) => job.jobType === 'INGEST');
          expect(ingestJob?.status).toBe('COMPLETED');
          expect(ingestJob?.snapshotCapturedAt).toBeTruthy();
        });
      }
    });
  }
});
