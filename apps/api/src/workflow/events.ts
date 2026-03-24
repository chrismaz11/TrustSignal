export type WorkflowEvent =
  | { type: 'workflow.created'; workflowId: string; actor: string; timestamp: string }
  | { type: 'workflow.run.started'; workflowId: string; runId: string; actor: string; timestamp: string }
  | { type: 'workflow.run.completed'; workflowId: string; runId: string; actor: string; timestamp: string }
  | { type: 'workflow.run.failed'; workflowId: string; runId: string; actor: string; timestamp: string; reason: string }
  | { type: 'workflow.artifact.created'; workflowId: string; artifactId: string; actor: string; classification: string; timestamp: string }
  | { type: 'workflow.artifact.verified'; workflowId: string; artifactId: string; actor: string; timestamp: string; verified: boolean }
  | { type: 'workflow.release.evaluated'; workflowId: string; artifactId: string; actor: string; target: string; timestamp: string; allowed: boolean }
  | { type: 'workflow.evidence_package.created'; workflowId: string; packageId: string; actor: string; classification: string; timestamp: string };

export type StoredWorkflowEvent = {
  id: string;
  workflowId: string;
  timestamp: string;
  operator: string;
  action: string;
  bundleId: string | null;
  decision: string | null;
  receiptId: string | null;
  eventType: WorkflowEvent['type'];
  runId: string | null;
  artifactId: string | null;
  packageId: string | null;
  classification: string | null;
  reason: string | null;
  payload: WorkflowEvent;
};

type WorkflowEventCreateInput = {
  workflowId: string;
  timestamp: Date;
  operator: string;
  action: string;
  bundleId: string | null;
  decision: string | null;
  receiptId: string | null;
  eventType: WorkflowEvent['type'];
  runId: string | null;
  artifactId: string | null;
  packageId: string | null;
  classification: string | null;
  reason: string | null;
  payload: WorkflowEvent;
};

type WorkflowEventRow = WorkflowEventCreateInput & {
  id: string;
};

type WorkflowEventPrismaDelegate = {
  create(args: { data: WorkflowEventCreateInput }): Promise<WorkflowEventRow>;
  findMany(args: {
    where: { workflowId: string };
    orderBy: { timestamp: 'asc' } | { timestamp: 'desc' };
  }): Promise<WorkflowEventRow[]>;
};

function toStoredWorkflowEvent(row: WorkflowEventRow): StoredWorkflowEvent {
  return {
    id: row.id,
    workflowId: row.workflowId,
    timestamp: row.timestamp.toISOString(),
    operator: row.operator,
    action: row.action,
    bundleId: row.bundleId,
    decision: row.decision,
    receiptId: row.receiptId,
    eventType: row.eventType,
    runId: row.runId,
    artifactId: row.artifactId,
    packageId: row.packageId,
    classification: row.classification,
    reason: row.reason,
    payload: row.payload
  };
}

function toCreateInput(event: WorkflowEvent): WorkflowEventCreateInput {
  const operator = event.actor || 'system';
  const artifactId = 'artifactId' in event ? event.artifactId : null;
  const packageId = 'packageId' in event ? event.packageId : null;
  const classification = 'classification' in event ? event.classification : null;
  const runId = 'runId' in event ? event.runId : null;
  const reason = 'reason' in event ? event.reason : null;
  const decision =
    'allowed' in event
      ? event.allowed
        ? 'allow'
        : 'block'
      : 'verified' in event
        ? event.verified
          ? 'verified'
          : 'not_verified'
        : event.type === 'workflow.run.completed'
          ? 'completed'
          : event.type === 'workflow.run.failed'
            ? 'failed'
            : null;

  return {
    workflowId: event.workflowId,
    timestamp: new Date(event.timestamp),
    operator,
    action: event.type,
    bundleId: artifactId ?? packageId,
    decision,
    receiptId: null,
    eventType: event.type,
    runId,
    artifactId,
    packageId,
    classification,
    reason,
    payload: event
  };
}

export interface WorkflowEventSink {
  record(event: WorkflowEvent): void;
  listByWorkflow(workflowId: string): Promise<StoredWorkflowEvent[]> | StoredWorkflowEvent[];
}

export class NoopWorkflowEventSink implements WorkflowEventSink {
  record(_event: WorkflowEvent): void {
    // Intentionally empty when persistence is unavailable.
  }

  listByWorkflow(_workflowId: string): StoredWorkflowEvent[] {
    return [];
  }
}

export class InMemoryWorkflowEventSink implements WorkflowEventSink {
  private readonly events: StoredWorkflowEvent[] = [];

  record(event: WorkflowEvent): void {
    const input = toCreateInput(event);
    this.events.push(
      toStoredWorkflowEvent({
        id: `${input.workflowId}:${this.events.length + 1}`,
        ...input
      })
    );
  }

  listByWorkflow(workflowId: string): StoredWorkflowEvent[] {
    return this.events.filter((event) => event.workflowId === workflowId);
  }
}

export class PrismaWorkflowEventSink implements WorkflowEventSink {
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(
    private readonly workflowEventDelegate: WorkflowEventPrismaDelegate,
    private readonly logger: { error: (payload: unknown, message?: string) => void } = console
  ) {}

  record(event: WorkflowEvent): void {
    const data = toCreateInput(event);
    this.pendingWrite = this.pendingWrite
      .then(async () => {
        await this.workflowEventDelegate.create({ data });
      })
      .catch((error) => {
        this.logger.error(
          {
            error_name: error instanceof Error ? error.name : 'UnknownError',
            workflow_id: event.workflowId,
            event_type: event.type
          },
          'failed to persist workflow event'
        );
      });
  }

  async listByWorkflow(workflowId: string): Promise<StoredWorkflowEvent[]> {
    await this.pendingWrite;
    const rows = await this.workflowEventDelegate.findMany({
      where: { workflowId },
      orderBy: { timestamp: 'asc' }
    });
    return rows.map(toStoredWorkflowEvent);
  }
}
