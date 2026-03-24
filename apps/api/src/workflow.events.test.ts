import { describe, expect, it, vi } from 'vitest';

import { PrismaWorkflowEventSink, type StoredWorkflowEvent } from './workflow/events.js';

describe('PrismaWorkflowEventSink', () => {
  it('persists normalized workflow audit events and returns them in timestamp order', async () => {
    const rows: Array<Record<string, unknown>> = [];
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `event-${rows.length + 1}`,
        ...data
      };
      rows.push(row);
      return row;
    });
    const findMany = vi.fn(async () => rows);

    const sink = new PrismaWorkflowEventSink({
      create,
      findMany
    });

    sink.record({
      type: 'workflow.created',
      workflowId: 'workflow-1',
      actor: 'operator@trustsignal.test',
      timestamp: '2026-03-20T05:00:00.000Z'
    });
    sink.record({
      type: 'workflow.release.evaluated',
      workflowId: 'workflow-1',
      artifactId: 'artifact-1',
      actor: 'operator@trustsignal.test',
      target: 'customer_shareable',
      timestamp: '2026-03-20T05:00:01.000Z',
      allowed: false
    });

    const events = await sink.listByWorkflow('workflow-1');

    expect(create).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledWith({
      where: { workflowId: 'workflow-1' },
      orderBy: { timestamp: 'asc' }
    });

    const [createdEvent, decisionEvent] = events as StoredWorkflowEvent[];
    expect(createdEvent.action).toBe('workflow.created');
    expect(createdEvent.operator).toBe('operator@trustsignal.test');
    expect(createdEvent.bundleId).toBeNull();
    expect(decisionEvent.bundleId).toBe('artifact-1');
    expect(decisionEvent.decision).toBe('block');
    expect(decisionEvent.payload).toMatchObject({
      type: 'workflow.release.evaluated',
      artifactId: 'artifact-1'
    });
  });
});
