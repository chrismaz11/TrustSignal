import { describe, it, expect, vi } from 'vitest';
import {
  WorkflowEvent,
  StoredWorkflowEvent,
  NoopWorkflowEventSink,
  InMemoryWorkflowEventSink,
  PrismaWorkflowEventSink
} from '../../../workflow/events.js';

describe('workflow events', () => {
  const mockEvent: WorkflowEvent = {
    type: 'workflow.created',
    workflowId: 'workflow1',
    actor: 'user1',
    timestamp: '2024-01-01T00:00:00Z'
  };

  describe('NoopWorkflowEventSink', () => {
    it('should not throw when recording events', () => {
      const sink = new NoopWorkflowEventSink();
      expect(() => sink.record(mockEvent)).not.toThrow();
    });

    it('should return empty list', () => {
      const sink = new NoopWorkflowEventSink();
      const result = sink.listByWorkflow('workflow1');
      expect(result).toEqual([]);
    });
  });

  describe('InMemoryWorkflowEventSink', () => {
    it('should record and list events', () => {
      const sink = new InMemoryWorkflowEventSink();
      sink.record(mockEvent);

      const result = sink.listByWorkflow('workflow1');
      expect(result.length).toBe(1);
      expect(result[0].workflowId).toBe('workflow1');
      expect(result[0].eventType).toBe('workflow.created');
    });

    it('should filter by workflowId', () => {
      const sink = new InMemoryWorkflowEventSink();
      sink.record(mockEvent);
      sink.record({ ...mockEvent, workflowId: 'workflow2' });

      const result = sink.listByWorkflow('workflow1');
      expect(result.length).toBe(1);
      expect(result[0].workflowId).toBe('workflow1');
    });

    it('should handle different event types', () => {
      const sink = new InMemoryWorkflowEventSink();
      const artifactEvent: WorkflowEvent = {
        type: 'workflow.artifact.created',
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        actor: 'user1',
        classification: 'public',
        timestamp: '2024-01-01T00:00:00Z'
      };

      sink.record(artifactEvent);
      const result = sink.listByWorkflow('workflow1');
      expect(result[0].artifactId).toBe('artifact1');
      expect(result[0].classification).toBe('public');
    });
  });

  describe('PrismaWorkflowEventSink', () => {
    const mockDelegate = {
      create: vi.fn().mockResolvedValue({
        id: 'event1',
        workflowId: 'workflow1',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        operator: 'user1',
        action: 'workflow.created',
        bundleId: null,
        decision: null,
        receiptId: null,
        eventType: 'workflow.created',
        runId: null,
        artifactId: null,
        packageId: null,
        classification: null,
        reason: null,
        payload: mockEvent
      }),
      findMany: vi.fn().mockResolvedValue([])
    };

    const mockLogger = {
      error: vi.fn()
    };

    it('should record events', async () => {
      const sink = new PrismaWorkflowEventSink(mockDelegate, mockLogger);
      sink.record(mockEvent);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDelegate.create).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const errorDelegate = {
        create: vi.fn().mockRejectedValue(new Error('db error')),
        findMany: vi.fn().mockResolvedValue([])
      };

      const sink = new PrismaWorkflowEventSink(errorDelegate, mockLogger);
      sink.record(mockEvent);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should list events by workflow', async () => {
      const mockRow = {
        id: 'event1',
        workflowId: 'workflow1',
        timestamp: new Date('2024-01-01T00:00:00Z'),
        operator: 'user1',
        action: 'workflow.created',
        bundleId: null,
        decision: null,
        receiptId: null,
        eventType: 'workflow.created',
        runId: null,
        artifactId: null,
        packageId: null,
        classification: null,
        reason: null,
        payload: mockEvent
      };

      const listDelegate = {
        create: vi.fn().mockResolvedValue(mockRow),
        findMany: vi.fn().mockResolvedValue([mockRow])
      };

      const sink = new PrismaWorkflowEventSink(listDelegate, mockLogger);
      await sink.record(mockEvent);

      const result = await sink.listByWorkflow('workflow1');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('event1');
    });
  });

  describe('event transformation', () => {
    it('should transform workflow.created event', () => {
      const sink = new InMemoryWorkflowEventSink();
      sink.record(mockEvent);
      const result = sink.listByWorkflow('workflow1');

      expect(result[0].operator).toBe('user1');
      expect(result[0].action).toBe('workflow.created');
      expect(result[0].decision).toBeNull();
    });

    it('should transform workflow.artifact.verified event', () => {
      const verifiedEvent: WorkflowEvent = {
        type: 'workflow.artifact.verified',
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        actor: 'user1',
        timestamp: '2024-01-01T00:00:00Z',
        verified: true
      };

      const sink = new InMemoryWorkflowEventSink();
      sink.record(verifiedEvent);
      const result = sink.listByWorkflow('workflow1');

      expect(result[0].decision).toBe('verified');
      expect(result[0].artifactId).toBe('artifact1');
    });

    it('should transform workflow.release.evaluated event', () => {
      const releaseEvent: WorkflowEvent = {
        type: 'workflow.release.evaluated',
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        actor: 'user1',
        target: 'customer_shareable',
        timestamp: '2024-01-01T00:00:00Z',
        allowed: false
      };

      const sink = new InMemoryWorkflowEventSink();
      sink.record(releaseEvent);
      const result = sink.listByWorkflow('workflow1');

      expect(result[0].decision).toBe('block');
      expect(result[0].target).toBe('customer_shareable');
    });
  });
});
