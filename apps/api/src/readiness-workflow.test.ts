import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';

import { buildServer } from './server.js';

describe('Enterprise readiness workflow API', () => {
  let app: FastifyInstance;
  const apiKey = 'test-readiness-workflow-key';

  beforeAll(async () => {
    process.env.API_KEYS = apiKey;
    process.env.API_KEY_SCOPES = `${apiKey}=verify|read`;
    app = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
  });

  it('rejects duplicate source refs and unknown readiness fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/readiness-audit',
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'readiness@trustsignal.test',
        sourceArtifacts: [
          {
            sourceRef: 'coverage',
            name: 'coverage-summary',
            classification: 'internal',
            content: { lines: 99.34 }
          },
          {
            sourceRef: 'coverage',
            name: 'coverage-summary-duplicate',
            classification: 'internal',
            content: { lines: 93.33 }
          }
        ],
        findings: [
          {
            id: 'lint-failure',
            title: 'Lint gate is failing',
            severity: 'high',
            status: 'open',
            details: 'npm run lint is failing.',
            evidenceSourceRefs: ['coverage']
          }
        ],
        summary: {
          conclusion: 'no_go',
          highlights: ['Duplicate source refs should fail validation.']
        },
        unexpected: true
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_workflow_payload');
  });

  it('returns a structured error when findings reference an unknown source ref', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/readiness-audit',
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'readiness@trustsignal.test',
        sourceArtifacts: [
          {
            sourceRef: 'coverage',
            name: 'coverage-summary',
            classification: 'internal',
            content: { lines: 99.34 }
          }
        ],
        findings: [
          {
            id: 'missing-proof',
            title: 'Missing proof artifact',
            severity: 'high',
            status: 'open',
            details: 'References a source that was not registered.',
            evidenceSourceRefs: ['does-not-exist']
          }
        ],
        summary: {
          conclusion: 'no_go',
          highlights: ['Unknown source refs should fail closed.']
        }
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('unknown_source_ref');
    expect(res.json().details.sourceRef).toBe('does-not-exist');
  });

  it('runs the readiness workflow end to end and blocks customer export of audit-private outputs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows/readiness-audit',
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'readiness@trustsignal.test',
        sourceArtifacts: [
          {
            sourceRef: 'coverage',
            name: 'coverage-summary',
            classification: 'internal',
            content: { lines: 99.34, functions: 93.33, statements: 100 }
          },
          {
            sourceRef: 'db-evidence-gap',
            name: 'db-runtime-gap',
            classification: 'audit_private',
            content: { missing: ['staging TLS', 'runtime TLS proof'] }
          }
        ],
        findings: [
          {
            id: 'lint-failure',
            title: 'Lint gate is failing',
            severity: 'high',
            status: 'open',
            details: 'npm run lint is failing in the current validated readiness package.',
            evidenceSourceRefs: ['coverage']
          },
          {
            id: 'db-evidence-missing',
            title: 'DB runtime evidence is not captured',
            severity: 'critical',
            status: 'open',
            details: 'No staging or production DB TLS/runtime evidence is attached.',
            evidenceSourceRefs: ['db-evidence-gap']
          }
        ],
        summary: {
          conclusion: 'no_go',
          highlights: [
            'Strong local engineering validation exists.',
            'Operational evidence remains incomplete.'
          ]
        },
        unsupportedClaims: [
          'TrustSignal is enterprise-ready.',
          'Staging TLS is evidenced.'
        ],
        unverifiedControls: [
          'staging TLS',
          'DB runtime/TLS',
          'backup/restore'
        ],
        releaseTargets: {
          findings: 'internal_draft',
          summary: 'customer_shareable'
        }
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.workflow.status).toBe('completed');
    expect(body.sourceArtifacts).toHaveLength(2);
    expect(body.evidenceReferences).toHaveLength(4);
    expect(body.verificationRecords).toHaveLength(2);
    expect(body.findingArtifact.classification).toBe('audit_private');
    expect(body.summaryArtifact.classification).toBe('audit_private');
    expect(body.releaseDecisions).toHaveLength(2);
    expect(body.releaseDecisions[0].target).toBe('internal_draft');
    expect(body.releaseDecisions[0].allowed).toBe(false);
    expect(body.releaseDecisions[1].target).toBe('customer_shareable');
    expect(body.releaseDecisions[1].allowed).toBe(false);
    expect(body.evidencePackage.summaryArtifactId).toBe(body.summaryArtifact.id);
    expect(body.evidencePackage.findingsArtifactId).toBe(body.findingArtifact.id);
    expect(body.evidencePackage.artifactIds).toHaveLength(4);
    expect(body.evidencePackage.verificationRecords).toHaveLength(2);
    expect(body.evidencePackage.releaseDecisions).toHaveLength(2);
    expect(body.evidencePackage.evidenceReferences).toHaveLength(4);
    expect(body.evidencePackage.classification).toBe('audit_private');
    expect(body.evidencePackage.unsupportedClaims).toEqual([
      'TrustSignal is enterprise-ready.',
      'Staging TLS is evidenced.'
    ]);
    expect(body.evidencePackage.unverifiedControls).toEqual([
      'staging TLS',
      'DB runtime/TLS',
      'backup/restore'
    ]);
    expect(body.result.releaseGate).toBe('blocked');
    expect(body.result.conclusion).toBe('no_go');

    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workflows/${body.workflow.id}/evidence-package`,
      headers: { 'x-api-key': apiKey }
    });

    expect(fetchRes.statusCode).toBe(200);
    expect(fetchRes.json().id).toBe(body.evidencePackage.id);
    expect(fetchRes.json().workflowId).toBe(body.workflow.id);
  });

  it('returns not found when a workflow has no evidence package yet', async () => {
    const workflowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { createdBy: 'readiness@trustsignal.test' }
    });
    const workflow = workflowRes.json();

    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workflows/${workflow.id}/evidence-package`,
      headers: { 'x-api-key': apiKey }
    });

    expect(fetchRes.statusCode).toBe(404);
    expect(fetchRes.json().error).toBe('evidence_package_not_found');
  });
});
