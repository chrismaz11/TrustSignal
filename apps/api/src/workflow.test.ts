import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';

import { buildServer } from './server.js';

describe('Trust Agents workflow orchestration', () => {
  let app: FastifyInstance;
  const apiKey = 'test-workflow-key';

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

  it('rejects missing API keys and missing verify scope on workflow routes', async () => {
    const missingAuth = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      payload: { createdBy: 'operator@trustsignal.test' }
    });

    const readOnlyKey = 'test-workflow-read-only-key';
    const originalApiKeys = process.env.API_KEYS;
    const originalApiKeyScopes = process.env.API_KEY_SCOPES;
    let readOnlyApp: FastifyInstance | null = null;

    try {
      process.env.API_KEYS = `${apiKey},${readOnlyKey}`;
      process.env.API_KEY_SCOPES = `${apiKey}=verify|read;${readOnlyKey}=read`;
      readOnlyApp = await buildServer({ logger: false });

      const forbidden = await readOnlyApp.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': readOnlyKey },
        payload: { createdBy: 'operator@trustsignal.test' }
      });

      expect(missingAuth.statusCode).toBe(401);
      expect(forbidden.statusCode).toBe(403);
    } finally {
      if (readOnlyApp) {
        await readOnlyApp.close();
      }
      process.env.API_KEYS = originalApiKeys;
      process.env.API_KEY_SCOPES = originalApiKeyScopes;
    }
  });

  it('rejects malformed workflow route payloads with structured validation errors', async () => {
    const createWorkflowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { createdBy: 'operator@trustsignal.test' }
    });
    const workflow = createWorkflowRes.json();

    const invalidArtifactRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/artifacts`,
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'operator@trustsignal.test',
        classification: 'partner_safe',
        parentIds: [],
        content: {},
        extraField: true
      }
    });

    const invalidRunRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/runs`,
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'operator@trustsignal.test',
        steps: [
          {
            agentId: 'trustagents.lineage.capture',
            inputArtifactIds: [],
            unexpected: 'value'
          }
        ]
      }
    });

    expect(invalidArtifactRes.statusCode).toBe(400);
    expect(invalidArtifactRes.json().error).toBe('invalid_workflow_payload');
    expect(invalidRunRes.statusCode).toBe(400);
    expect(invalidRunRes.json().error).toBe('invalid_workflow_payload');
  });

  it('lists built-in Trust Agents with deterministic in-memory registry metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trust-agents',
      headers: { 'x-api-key': apiKey }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.registryIntegrity.mode).toBe('static-in-memory');
    expect(body.registryIntegrity.deterministicLoad).toBe(true);
    expect(body.agents.map((agent: { id: string }) => agent.id)).toEqual([
      'trustagents.lineage.capture',
      'trustagents.integrity.verify',
      'trustagents.artifact.bundle',
      'trustagents.readiness.findings',
      'trustagents.readiness.summary'
    ]);
  });

  it('creates verifiable workflow artifacts and records lineage across workflow steps', async () => {
    const workflowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { createdBy: 'operator@trustsignal.test' }
    });
    expect(workflowRes.statusCode).toBe(201);
    const workflow = workflowRes.json();

    const artifactRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/artifacts`,
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'operator@trustsignal.test',
        classification: 'internal',
        parentIds: [],
        content: {
          schemaVersion: 'trustsignal.workflow.input.v1',
          source: 'unit-test',
          subject: { receiptId: 'receipt-001' }
        }
      }
    });
    expect(artifactRes.statusCode).toBe(201);
    const inputArtifact = artifactRes.json();
    expect(inputArtifact.workflowId).toBe(workflow.id);
    expect(inputArtifact.classification).toBe('internal');
    expect(Array.isArray(inputArtifact.parentIds)).toBe(true);
    expect(typeof inputArtifact.hash).toBe('string');

    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/artifacts/${inputArtifact.id}/verify`,
      headers: { 'x-api-key': apiKey }
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().verified).toBe(true);

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/runs`,
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'operator@trustsignal.test',
        steps: [
          {
            agentId: 'trustagents.lineage.capture',
            inputArtifactIds: [inputArtifact.id]
          },
          {
            agentId: 'trustagents.integrity.verify',
            inputArtifactIds: [inputArtifact.id]
          }
        ]
      }
    });
    expect(runRes.statusCode).toBe(201);
    const run = runRes.json();
    expect(run.steps).toHaveLength(2);
    expect(run.steps.every((step: { status: string }) => step.status === 'completed')).toBe(true);

    const stateRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workflows/${workflow.id}`,
      headers: { 'x-api-key': apiKey }
    });
    expect(stateRes.statusCode).toBe(200);
    const state = stateRes.json();
    expect(state.workflow.status).toBe('completed');
    expect(state.runs).toHaveLength(1);
    expect(state.artifacts).toHaveLength(3);
    expect(state.verifications.length).toBeGreaterThanOrEqual(2);

    const lineageArtifact = state.artifacts.find((artifact: { parentIds: string[] }) => artifact.parentIds.includes(inputArtifact.id));
    expect(lineageArtifact).toBeTruthy();
  });

  it('fails closed when a requested agent is not registered', async () => {
    const workflowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/workflows',
      headers: { 'x-api-key': apiKey },
      payload: { createdBy: 'operator@trustsignal.test' }
    });
    const workflow = workflowRes.json();

    const runRes = await app.inject({
      method: 'POST',
      url: `/api/v1/workflows/${workflow.id}/runs`,
      headers: { 'x-api-key': apiKey },
      payload: {
        createdBy: 'operator@trustsignal.test',
        steps: [
          {
            agentId: 'trustagents.missing.agent',
            inputArtifactIds: []
          }
        ]
      }
    });

    expect(runRes.statusCode).toBe(404);
    expect(runRes.json().error).toBe('agent_not_found');

    const stateRes = await app.inject({
      method: 'GET',
      url: `/api/v1/workflows/${workflow.id}`,
      headers: { 'x-api-key': apiKey }
    });
    expect(stateRes.statusCode).toBe(200);
    expect(stateRes.json().workflow.status).toBe('failed');
  });

  it('isolates workflow state between server instances', async () => {
    const isolatedApp = await buildServer({ logger: false });
    try {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/workflows',
        headers: { 'x-api-key': apiKey },
        payload: { createdBy: 'operator@trustsignal.test' }
      });
      const workflow = createRes.json();

      const missingRes = await isolatedApp.inject({
        method: 'GET',
        url: `/api/v1/workflows/${workflow.id}`,
        headers: { 'x-api-key': apiKey }
      });

      expect(missingRes.statusCode).toBe(404);
      expect(missingRes.json().error).toBe('workflow_not_found');
    } finally {
      await isolatedApp.close();
    }
  });
});
