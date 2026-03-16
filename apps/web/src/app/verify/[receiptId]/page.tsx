const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://localhost:3001';

type ReceiptInspectorResponse = {
  receiptId: string;
  artifact: {
    hash: string;
    algorithm: string;
  };
  source: {
    provider: string;
    repository?: string;
    workflow?: string;
    runId?: string;
    commit?: string;
    actor?: string;
  };
  status: string;
  createdAt: string;
  receiptSignature: {
    alg: string;
    kid: string;
  };
};

async function loadReceipt(receiptId: string): Promise<ReceiptInspectorResponse | null> {
  const response = await fetch(`${API_BASE}/api/v1/receipt/${receiptId}`, {
    cache: 'no-store'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load receipt');
  }

  return (await response.json()) as ReceiptInspectorResponse;
}

function renderValue(value: string | undefined) {
  return value || 'Not provided';
}

export default async function PublicReceiptInspectorPage({
  params
}: {
  params: { receiptId: string };
}) {
  const detail = await loadReceipt(params.receiptId);

  if (!detail) {
    return (
      <section className="grid">
        <div className="card">
          <h2>Receipt not found</h2>
          <p className="muted">
            No public TrustSignal receipt was found for this identifier.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="card">
        <p className="eyebrow">Public verification inspector</p>
        <h2>TrustSignal receipt {detail.receiptId}</h2>
        <p className="muted">
          TrustSignal provides verification signals and signed receipts; it does not
          make legal determinations.
        </p>
      </div>

      <div className="card">
        <h3>Status</h3>
        <p>
          <strong>{detail.status}</strong>
        </p>
        <p className="muted">
          Issued {new Date(detail.createdAt).toLocaleString()}
        </p>
        <p>
          This receipt can be referenced later to verify whether the same artifact
          hash still matches the stored verification record.
        </p>
      </div>

      <div className="card">
        <h3>Artifact</h3>
        <p className="mono">{detail.artifact.hash}</p>
        <p>Algorithm: {detail.artifact.algorithm}</p>
      </div>

      <div className="card">
        <h3>Source</h3>
        <p>Provider: {detail.source.provider}</p>
        <p>Repository: {renderValue(detail.source.repository)}</p>
        <p>Workflow: {renderValue(detail.source.workflow)}</p>
        <p>Run ID: {renderValue(detail.source.runId)}</p>
        <p>Commit: {renderValue(detail.source.commit)}</p>
        <p>Actor: {renderValue(detail.source.actor)}</p>
      </div>

      <div className="card">
        <h3>Receipt signature</h3>
        <p>Algorithm: {detail.receiptSignature.alg}</p>
        <p className="mono">Key ID: {detail.receiptSignature.kid}</p>
      </div>
    </section>
  );
}
