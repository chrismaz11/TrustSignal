import { describe, it, expect, vi } from 'vitest';
import { createRegistryAdapterService, getOfficialRegistrySourceName, REGISTRY_SOURCE_IDS } from '../../../services/registryAdapters.js';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client');

describe('registryAdapters', () => {
  describe('getOfficialRegistrySourceName', () => {
    it('should return official name for known source', () => {
      const name = getOfficialRegistrySourceName('ofac_sdn');
      expect(name).toBe('U.S. Department of the Treasury - OFAC SDN List');
    });

    it('should return undefined for unknown source', () => {
      const name = getOfficialRegistrySourceName('unknown');
      expect(name).toBeUndefined();
    });
  });

  describe('REGISTRY_SOURCE_IDS', () => {
    it('should contain expected sources', () => {
      expect(REGISTRY_SOURCE_IDS).toContain('ofac_sdn');
      expect(REGISTRY_SOURCE_IDS).toContain('hhs_oig_leie');
      expect(REGISTRY_SOURCE_IDS).toContain('sam_exclusions');
    });

    it('should have consistent length', () => {
      expect(REGISTRY_SOURCE_IDS.length).toBeGreaterThan(0);
    });
  });

  describe('createRegistryAdapterService', () => {
    const mockPrisma = {
      registrySource: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn()
      },
      registryCache: {
        findUnique: vi.fn(),
        upsert: vi.fn()
      },
      registryOracleJob: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn()
      }
    } as unknown as PrismaClient;

    const mockFetch = vi.fn();

    it('should create service with default fetch', () => {
      const service = createRegistryAdapterService(mockPrisma);
      expect(service).toBeDefined();
    });

    it('should create service with custom fetch', () => {
      const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
      expect(service).toBeDefined();
    });

    describe('listSources', () => {
      it('should list registry sources', async () => {
        const mockSources = [
          {
            id: 'ofac_sdn',
            name: 'OFAC SDN',
            category: 'sanctions',
            endpoint: 'https://example.com',
            zkCircuit: 'sanctions_nonmembership',
            active: true,
            freeTier: true,
            fetchIntervalMinutes: 360,
            parserVersion: 'v1',
            lastFetchedAt: null,
            lastSuccessAt: null,
            lastError: null
          }
        ];

        vi.mocked(mockPrisma.registrySource.findMany).mockResolvedValue(mockSources);
        vi.mocked(mockPrisma.registrySource.upsert).mockResolvedValue(mockSources[0]);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.listSources();

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('ofac_sdn');
      });

      it('should handle empty sources', async () => {
        vi.mocked(mockPrisma.registrySource.findMany).mockResolvedValue([]);
        vi.mocked(mockPrisma.registrySource.upsert).mockResolvedValue(undefined);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.listSources();

        expect(result).toEqual([]);
      });
    });

    describe('verify', () => {
      it('should throw for unknown source', async () => {
        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(null);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        await expect(service.verify({ sourceId: 'unknown', subject: 'John Doe' })).rejects.toThrow('registry_source_not_found');
      });

      it('should return cached result when available', async () => {
        const now = new Date();
        const future = new Date(now.getTime() + 60 * 60 * 1000);

        const mockSource = {
          id: 'ofac_sdn',
          name: 'OFAC SDN',
          category: 'sanctions',
          endpoint: 'https://example.com',
          zkCircuit: 'sanctions_nonmembership',
          active: true,
          freeTier: true,
          fetchIntervalMinutes: 360,
          parserVersion: 'v1'
        };

        const mockCache = {
          sourceId: 'ofac_sdn',
          subjectHash: 'hash1',
          responseJson: JSON.stringify({
            sourceId: 'ofac_sdn',
            sourceName: 'OFAC SDN',
            category: 'sanctions',
            zkCircuit: 'sanctions_nonmembership',
            subject: 'John Doe',
            status: 'NO_MATCH',
            matched: false,
            matches: [],
            checkedAt: now.toISOString(),
            sourceVersion: 'v1'
          }),
          status: 'NO_MATCH',
          fetchedAt: now,
          expiresAt: future,
          sourceVersion: 'v1'
        };

        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(mockSource);
        vi.mocked(mockPrisma.registryCache.findUnique).mockResolvedValue(mockCache);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.verify({ sourceId: 'ofac_sdn', subject: 'John Doe' });

        expect(result.cached).toBe(true);
        expect(result.status).toBe('NO_MATCH');
      });

      it('should perform fresh lookup when cache expired', async () => {
        const now = new Date();
        const past = new Date(now.getTime() - 60 * 60 * 1000);

        const mockSource = {
          id: 'ofac_sdn',
          name: 'OFAC SDN',
          category: 'sanctions',
          endpoint: 'https://example.com',
          zkCircuit: 'sanctions_nonmembership',
          active: true,
          freeTier: true,
          fetchIntervalMinutes: 360,
          parserVersion: 'v1'
        };

        const mockCache = {
          sourceId: 'ofac_sdn',
          subjectHash: 'hash1',
          responseJson: JSON.stringify({
            sourceId: 'ofac_sdn',
            sourceName: 'OFAC SDN',
            category: 'sanctions',
            zkCircuit: 'sanctions_nonmembership',
            subject: 'John Doe',
            status: 'NO_MATCH',
            matched: false,
            matches: [],
            checkedAt: now.toISOString(),
            sourceVersion: 'v1'
          }),
          status: 'NO_MATCH',
          fetchedAt: now,
          expiresAt: past,
          sourceVersion: 'v1'
        };

        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(mockSource);
        vi.mocked(mockPrisma.registryCache.findUnique).mockResolvedValue(mockCache);

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve('name\nJohn Doe'),
          headers: new Map([['etag', 'etag1']])
        });

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.verify({ sourceId: 'ofac_sdn', subject: 'John Doe' });

        expect(result.cached).toBe(false);
        expect(mockFetch).toHaveBeenCalled();
      });

      it('should handle lookup errors', async () => {
        const mockSource = {
          id: 'ofac_sdn',
          name: 'OFAC SDN',
          category: 'sanctions',
          endpoint: 'https://example.com',
          zkCircuit: 'sanctions_nonmembership',
          active: true,
          freeTier: true,
          fetchIntervalMinutes: 360,
          parserVersion: 'v1'
        };

        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(mockSource);
        vi.mocked(mockPrisma.registryCache.findUnique).mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: false,
          status: 500
        });

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.verify({ sourceId: 'ofac_sdn', subject: 'John Doe' });

        expect(result.status).toBe('COMPLIANCE_GAP');
        expect(result.details).toContain('primary source lookup failed');
      });
    });

    describe('verifyBatch', () => {
      it('should verify multiple sources', async () => {
        const mockSource = {
          id: 'ofac_sdn',
          name: 'OFAC SDN',
          category: 'sanctions',
          endpoint: 'https://example.com',
          zkCircuit: 'sanctions_nonmembership',
          active: true,
          freeTier: true,
          fetchIntervalMinutes: 360,
          parserVersion: 'v1'
        };

        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(mockSource);
        vi.mocked(mockPrisma.registryCache.findUnique).mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve('name\nJohn Doe'),
          headers: new Map([['etag', 'etag1']])
        });

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.verifyBatch({ sourceIds: ['ofac_sdn'], subject: 'John Doe' });

        expect(result.results.length).toBe(1);
        expect(result.summary.totalSources).toBe(1);
      });

      it('should deduplicate source IDs', async () => {
        const mockSource = {
          id: 'ofac_sdn',
          name: 'OFAC SDN',
          category: 'sanctions',
          endpoint: 'https://example.com',
          zkCircuit: 'sanctions_nonmembership',
          active: true,
          freeTier: true,
          fetchIntervalMinutes: 360,
          parserVersion: 'v1'
        };

        vi.mocked(mockPrisma.registrySource.findUnique).mockResolvedValue(mockSource);
        vi.mocked(mockPrisma.registryCache.findUnique).mockResolvedValue(null);

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve('name\nJohn Doe'),
          headers: new Map([['etag', 'etag1']])
        });

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.verifyBatch({ sourceIds: ['ofac_sdn', 'ofac_sdn'], subject: 'John Doe' });

        expect(result.results.length).toBe(1);
      });
    });

    describe('getOracleJob', () => {
      it('should return null for non-existent job', async () => {
        vi.mocked(mockPrisma.registryOracleJob.findUnique).mockResolvedValue(null);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.getOracleJob('job1');

        expect(result).toBeNull();
      });

      it('should return job details', async () => {
        const now = new Date();
        const mockJob = {
          id: 'job1',
          sourceId: 'ofac_sdn',
          zkCircuit: 'sanctions_nonmembership',
          status: 'DISPATCHED',
          resultStatus: 'NO_MATCH',
          proofUri: 'https://example.com/proof',
          error: null,
          createdAt: now,
          completedAt: now
        };

        vi.mocked(mockPrisma.registryOracleJob.findUnique).mockResolvedValue(mockJob);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.getOracleJob('job1');

        expect(result).toBeDefined();
        expect(result?.id).toBe('job1');
        expect(result?.status).toBe('DISPATCHED');
      });
    });

    describe('listOracleJobs', () => {
      it('should return empty list when no jobs', async () => {
        vi.mocked(mockPrisma.registryOracleJob.findMany).mockResolvedValue([]);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.listOracleJobs();

        expect(result).toEqual([]);
      });

      it('should return jobs list', async () => {
        const now = new Date();
        const mockJobs = [
          {
            id: 'job1',
            sourceId: 'ofac_sdn',
            zkCircuit: 'sanctions_nonmembership',
            status: 'DISPATCHED',
            resultStatus: 'NO_MATCH',
            proofUri: 'https://example.com/proof',
            error: null,
            createdAt: now,
            completedAt: now
          }
        ];

        vi.mocked(mockPrisma.registryOracleJob.findMany).mockResolvedValue(mockJobs);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.listOracleJobs();

        expect(result.length).toBe(1);
        expect(result[0].id).toBe('job1');
      });

      it('should respect limit', async () => {
        const now = new Date();
        const mockJobs = Array(10).fill(0).map((_, i) => ({
          id: `job${i}`,
          sourceId: 'ofac_sdn',
          zkCircuit: 'sanctions_nonmembership',
          status: 'DISPATCHED',
          resultStatus: 'NO_MATCH',
          proofUri: 'https://example.com/proof',
          error: null,
          createdAt: now,
          completedAt: now
        }));

        vi.mocked(mockPrisma.registryOracleJob.findMany).mockResolvedValue(mockJobs);

        const service = createRegistryAdapterService(mockPrisma, { fetchImpl: mockFetch });
        const result = await service.listOracleJobs(5);

        expect(result.length).toBe(5);
      });
    });
  });

  describe('utility functions', () => {
    it('should normalize names', () => {
      const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      expect(normalizeName('John Doe')).toBe('john doe');
      expect(normalizeName('JOHN DOE')).toBe('john doe');
      expect(normalizeName('John  Doe')).toBe('john doe');
      expect(normalizeName('John-Doe')).toBe('john doe');
    });

    it('should tokenize names', () => {
      const tokenize = (value: string) => normalizeName(value).split(' ').filter((part) => part.length > 0);
      const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      expect(tokenize('John Doe')).toEqual(['john', 'doe']);
      expect(tokenize('John  Doe')).toEqual(['john', 'doe']);
    });

    it('should score candidate matches', () => {
      const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const tokenize = (value: string) => normalizeName(value).split(' ').filter((part) => part.length > 0);
      const scoreCandidate = (subject: string, candidate: string) => {
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
      };

      expect(scoreCandidate('John Doe', 'John Doe')).toBe(1);
      expect(scoreCandidate('John Doe', 'Doe John')).toBe(0.9);
      expect(scoreCandidate('John Doe', 'Jane Doe')).toBe(0.5);
      expect(scoreCandidate('John Doe', 'Bob Smith')).toBe(0);
    });
  });
});
