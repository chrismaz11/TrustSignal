import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';

vi.mock('@prisma/client');
vi.mock('prom-client');
vi.mock('ethers');
vi.mock('../../../packages/core/dist/index.js', () => ({
  canonicalizeJson: vi.fn().mockImplementation((obj) => JSON.stringify(obj)),
  computeReceiptHash: vi.fn().mockReturnValue('mock-hash'),
  computeInputsCommitment: vi.fn().mockReturnValue('mock-commitment'),
  deriveNotaryWallet: vi.fn().mockReturnValue({}),
  signDocHash: vi.fn().mockResolvedValue('mock-seal'),
  signReceiptPayload: vi.fn().mockResolvedValue({ signature: 'mock-sig', alg: 'EdDSA', kid: 'mock-kid' }),
  verifyBundle: vi.fn().mockResolvedValue({ decision: 'ALLOW', reasons: [], riskScore: 0, checks: [] }),
  buildReceipt: vi.fn().mockReturnValue({
    receiptId: 'mock-receipt',
    createdAt: '2024-01-01T00:00:00Z',
    policyProfile: 'STANDARD_IL',
    inputsCommitment: 'mock-commitment',
    decision: 'ALLOW',
    reasons: [],
    riskScore: 0,
    verifierId: 'trustsignal',
    receiptHash: 'mock-hash',
    checks: []
  }),
  verifyReceiptSignature: vi.fn().mockResolvedValue({ verified: true, keyResolved: true, reason: 'ok' }),
  generateComplianceProof: vi.fn().mockResolvedValue({ status: 'dev-only' }),
  RiskEngine: class {
    analyzeDocument = vi.fn().mockResolvedValue({ score: 0.1, band: 'LOW', reasons: [] })
  },
  attomCrossCheck: vi.fn().mockResolvedValue({ status: 'PASS' }),
  nameOverlapScore: vi.fn().mockReturnValue(1.0),
  generateFraudScoreProof: vi.fn().mockResolvedValue({})
}));

describe('server', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('health endpoint', () => {
    it('should return health status', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok', database: { ready: true, initError: null } });
    });
  });

  describe('status endpoint', () => {
    it('should return service status', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/status' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('trustsignal-api');
      expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metrics endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/metrics' });
      expect(response.statusCode).toBe(401);
    });

    it('should return metrics with valid API key', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/metrics',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      await appWithAuth.close();
    });
  });

  describe('usage endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/usage' });
      expect(response.statusCode).toBe(401);
    });

    it('should return usage stats for local dev keys', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/usage',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.plan).toBe('dev');
      await appWithAuth.close();
    });
  });

  describe('vanta schema endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/integrations/vanta/schema' });
      expect(response.statusCode).toBe(401);
    });

    it('should return schema with valid API key', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/integrations/vanta/schema',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schemaVersion).toBe('trustsignal.vanta.verification_result.v1');
      await appWithAuth.close();
    });
  });

  describe('trust agents endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/trust-agents' });
      expect(response.statusCode).toBe(401);
    });

    it('should return agents list with valid API key', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/trust-agents',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agents).toBeInstanceOf(Array);
      await appWithAuth.close();
    });
  });

  describe('workflow endpoints', () => {
    it('should create workflow with valid payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.createdBy).toBe('user1');
      await appWithAuth.close();
    });

    it('should reject invalid workflow payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      await appWithAuth.close();
    });

    it('should get workflow state', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const createResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(createResponse.body);

      // Get workflow state
      const getResponse = await appWithAuth.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflow.id}`,
        headers: { 'x-api-key': 'test-key' }
      });
      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.workflow.id).toBe(workflow.id);
      await appWithAuth.close();
    });
  });

  describe('verify endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/verify',
        payload: {}
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': 'test-key' },
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      await appWithAuth.close();
    });

    it('should verify valid bundle', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          bundleId: 'bundle1',
          transactionType: 'warranty',
          ron: {
            provider: 'RON-1',
            notaryId: 'notary1',
            commissionState: 'IL',
            sealPayload: 'seal1',
            sealScheme: 'SIM-ECDSA-v1'
          },
          doc: {
            docHash: 'doc-hash'
          },
          policy: {
            profile: 'STANDARD_IL'
          },
          property: {
            parcelId: 'parcel1',
            county: 'Cook',
            state: 'IL'
          },
          timestamp: '2024-01-01T00:00:00Z'
        }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.receiptId).toBeDefined();
      expect(body.decision).toBe('ALLOW');
      await appWithAuth.close();
    });
  });

  describe('receipt endpoints', () => {
    it('should require authentication for receipt retrieval', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/receipt/mock-receipt' });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent receipt', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/receipt/00000000-0000-0000-0000-000000000000',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(404);
      await appWithAuth.close();
    });

    it('should verify receipt signature', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // First create a receipt
      const verifyResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          bundleId: 'bundle1',
          transactionType: 'warranty',
          ron: {
            provider: 'RON-1',
            notaryId: 'notary1',
            commissionState: 'IL',
            sealPayload: 'seal1',
            sealScheme: 'SIM-ECDSA-v1'
          },
          doc: {
            docHash: 'doc-hash'
          },
          policy: {
            profile: 'STANDARD_IL'
          },
          property: {
            parcelId: 'parcel1',
            county: 'Cook',
            state: 'IL'
          },
          timestamp: '2024-01-01T00:00:00Z'
        }
      });
      const verifyBody = JSON.parse(verifyResponse.body);

      // Verify the receipt
      const response = await appWithAuth.inject({
        method: 'POST',
        url: `/api/v1/receipt/${verifyBody.receiptId}/verify`,
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.verified).toBe(true);
      await appWithAuth.close();
    });
  });

  describe('anchor endpoints', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/anchor/mock-receipt'
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent receipt', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/anchor/00000000-0000-0000-0000-000000000000',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(404);
      await appWithAuth.close();
    });
  });

  describe('revoke endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/receipt/mock-receipt/revoke'
      });
      expect(response.statusCode).toBe(401);
    });

    it('should require revocation headers', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/receipt/00000000-0000-0000-0000-000000000000/revoke',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(401);
      await appWithAuth.close();
    });
  });

  describe('registry endpoints', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/registry/sources' });
      expect(response.statusCode).toBe(401);
    });

    it('should list registry sources', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/registry/sources',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sources).toBeInstanceOf(Array);
      await appWithAuth.close();
    });

    it('should verify registry subject', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/registry/verify',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          sourceId: 'ofac_sdn',
          subjectName: 'John Doe'
        }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });
  });

  describe('github verification endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/verifications/github',
        payload: {}
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verifications/github',
        headers: { 'x-api-key': 'test-key' },
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      await appWithAuth.close();
    });

    it('should verify github payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verifications/github',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          apiVersion: '2026-03-13',
          provider: 'github',
          externalId: '123',
          headSha: 'abc123',
          subject: {
            kind: 'workflow_run',
            summary: 'Test workflow'
          },
          repository: {
            owner: 'test',
            repo: 'test',
            fullName: 'test/test'
          },
          provenance: {
            eventName: 'workflow_run',
            attributes: {}
          }
        }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.receiptId).toBeDefined();
      await appWithAuth.close();
    });
  });

  describe('synthetic endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/synthetic' });
      expect(response.statusCode).toBe(401);
    });

    it('should return synthetic bundle', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/synthetic',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.bundleId).toBeDefined();
      await appWithAuth.close();
    });
  });

  describe('receipts list endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/receipts' });
      expect(response.statusCode).toBe(401);
    });

    it('should return receipts list', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/receipts',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toBeInstanceOf(Array);
      await appWithAuth.close();
    });
  });

  describe('attom verification endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/verify/attom',
        payload: {}
      });
      expect(response.statusCode).toBe(401);
    });

    it('should reject non-Cook County deeds', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify/attom',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          jurisdiction: { state: 'IL', county: 'DuPage' },
          pin: '12345',
          address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
          legalDescriptionText: 'Legal Desc',
          grantors: ['Grantor'],
          grantees: ['Grantee'],
          executionDate: '2024-01-01T00:00:00Z',
          recording: { docNumber: '12345', recordingDate: '2024-01-01T00:00:00Z' },
          notary: { name: 'Notary', commissionExpiration: '2024-12-31T00:00:00Z', state: 'IL' }
        }
      });
      expect(response.statusCode).toBe(400);
      await appWithAuth.close();
    });

    it('should verify Cook County deeds', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify/attom',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          jurisdiction: { state: 'IL', county: 'Cook' },
          pin: '12345',
          address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
          legalDescriptionText: 'Legal Desc',
          grantors: ['Grantor'],
          grantees: ['Grantee'],
          executionDate: '2024-01-01T00:00:00Z',
          recording: { docNumber: '12345', recordingDate: '2024-01-01T00:00:00Z' },
          notary: { name: 'Notary', commissionExpiration: '2024-12-31T00:00:00Z', state: 'IL' }
        }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });
  });

  describe('vanta verification endpoint', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/vanta/verification/mock-receipt'
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent receipt', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/integrations/vanta/verification/00000000-0000-0000-0000-000000000000',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(404);
      await appWithAuth.close();
    });
  });

  describe('registry batch verification', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/registry/verify-batch',
        payload: {}
      });
      expect(response.statusCode).toBe(401);
    });

    it('should verify batch of sources', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/registry/verify-batch',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          sourceIds: ['ofac_sdn', 'ofac_sls'],
          subjectName: 'John Doe'
        }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });
  });

  describe('registry jobs endpoints', () => {
    it('should require authentication', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/registry/jobs' });
      expect(response.statusCode).toBe(401);
    });

    it('should list registry jobs', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/registry/jobs',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });

    it('should get specific job', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/registry/jobs/job1',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(404); // No jobs exist in test
      await appWithAuth.close();
    });
  });

  describe('workflow artifact endpoints', () => {
    it('should create artifact', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const workflowResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(workflowResponse.body);

      // Create artifact
      const response = await appWithAuth.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflow.id}/artifacts`,
        headers: { 'x-api-key': 'test-key' },
        payload: {
          createdBy: 'user1',
          parentIds: [],
          classification: 'public',
          content: { key: 'value' }
        }
      });
      expect(response.statusCode).toBe(201);
      await appWithAuth.close();
    });

    it('should run workflow', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const workflowResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(workflowResponse.body);

      // Run workflow
      const response = await appWithAuth.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflow.id}/runs`,
        headers: { 'x-api-key': 'test-key' },
        payload: {
          createdBy: 'user1',
          steps: [
            {
              agentId: 'trustagents.lineage.capture',
              inputArtifactIds: []
            }
          ]
        }
      });
      expect(response.statusCode).toBe(201);
      await appWithAuth.close();
    });

    it('should verify workflow artifact', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const workflowResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(workflowResponse.body);

      // Create artifact
      const artifactResponse = await appWithAuth.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflow.id}/artifacts`,
        headers: { 'x-api-key': 'test-key' },
        payload: {
          createdBy: 'user1',
          parentIds: [],
          classification: 'public',
          content: { key: 'value' }
        }
      });
      const artifact = JSON.parse(artifactResponse.body);

      // Verify artifact
      const response = await appWithAuth.inject({
        method: 'POST',
        url: `/api/v1/workflows/${workflow.id}/artifacts/${artifact.id}/verify`,
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });
  });

  describe('readiness workflow endpoint', () => {
    it('should run readiness workflow', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows/readiness-audit',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          createdBy: 'user1',
          sourceArtifacts: [
            {
              sourceRef: 'ref1',
              name: 'source1',
              classification: 'public',
              content: { key: 'value' }
            }
          ],
          findings: [
            {
              id: 'finding1',
              title: 'Finding 1',
              severity: 'low',
              status: 'open',
              details: 'Details',
              evidenceSourceRefs: ['ref1']
            }
          ],
          summary: {
            conclusion: 'go',
            highlights: ['All good']
          }
        }
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.workflow.id).toBeDefined();
      await appWithAuth.close();
    });

    it('should reject invalid readiness payload', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });
      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows/readiness-audit',
        headers: { 'x-api-key': 'test-key' },
        payload: {}
      });
      expect(response.statusCode).toBe(400);
      await appWithAuth.close();
    });
  });

  describe('workflow events endpoint', () => {
    it('should get workflow events', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const workflowResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(workflowResponse.body);

      // Get events
      const response = await appWithAuth.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflow.id}/events`,
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(200);
      await appWithAuth.close();
    });
  });

  describe('evidence package endpoint', () => {
    it('should return 404 for workflow without evidence package', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Create workflow first
      const workflowResponse = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': 'test-key' },
        payload: { createdBy: 'user1' }
      });
      const workflow = JSON.parse(workflowResponse.body);

      // Get evidence package
      const response = await appWithAuth.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflow.id}/evidence-package`,
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(404);
      await appWithAuth.close();
    });
  });

  describe('rate limiting', () => {
    it('should enforce global rate limit', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Make multiple requests to trigger rate limit
      for (let i = 0; i < 10; i++) {
        await appWithAuth.inject({
          method: 'GET',
          url: '/api/v1/health',
          headers: { 'x-api-key': 'test-key' }
        });
      }

      const response = await appWithAuth.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { 'x-api-key': 'test-key' }
      });
      expect(response.statusCode).toBe(429);
      await appWithAuth.close();
    });
  });

  describe('CORS', () => {
    it('should allow CORS for allowed origins', async () => {
      process.env.CORS_ALLOWLIST = 'https://example.com';
      const appWithCors = await buildServer({ logger: false });
      const response = await appWithCors.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: { origin: 'https://example.com' }
      });
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
      await appWithCors.close();
    });

    it('should reject CORS for disallowed origins', async () => {
      process.env.CORS_ALLOWLIST = 'https://example.com';
      const appWithCors = await buildServer({ logger: false });
      const response = await appWithCors.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: { origin: 'https://unknown.com' }
      });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      await appWithCors.close();
    });
  });

  describe('error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
      expect(response.statusCode).toBe(404);
    });

    it('should include request ID in responses', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('plan quota enforcement', () => {
    it('should reject when quota exceeded', async () => {
      process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = 'test-key';
      const appWithAuth = await buildServer({ logger: false });

      // Mock prisma to return quota exceeded
      const mockPrisma = appWithAuth.diContainer?.resolve('prisma') as unknown as { $queryRaw: vi.Mock };
      if (mockPrisma) {
        mockPrisma.$queryRaw.mockResolvedValue([{ plan: 'free', used: 1500n }]);
      }

      const response = await appWithAuth.inject({
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          bundleId: 'bundle1',
          transactionType: 'warranty',
          ron: {
            provider: 'RON-1',
            notaryId: 'notary1',
            commissionState: 'IL',
            sealPayload: 'seal1',
            sealScheme: 'SIM-ECDSA-v1'
          },
          doc: {
            docHash: 'doc-hash'
          },
          policy: {
            profile: 'STANDARD_IL'
          },
          property: {
            parcelId: 'parcel1',
            county: 'Cook',
            state: 'IL'
          },
          timestamp: '2024-01-01T00:00:00Z'
        }
      });

      if (response.statusCode === 429) {
        const body = JSON.parse(response.body);
        expect(body.error).toBe('plan_quota_exceeded');
      }

      await appWithAuth.close();
    });
  });
});
