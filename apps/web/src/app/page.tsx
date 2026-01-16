import Link from 'next/link';
import { FileDropzone } from '../components/FileDropzone';

export default function HomePage() {
  return (
    <section className="hero">
      <div className="card">
        <h2>End-to-end recording integrity</h2>
        <p className="muted">
          Validate RON seals, check notary authority, and anchor verification receipts on-chain.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <Link className="button" href="/verify">
            Run Verification
          </Link>
          <Link className="button secondary" href="/receipts">
            Browse Receipts
          </Link>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Instant Pre-Check</h3>
          <FileDropzone />
        </div>
      </div>
      <div className="card">
        <h3>What happens</h3>
        <ol className="muted">
          <li>Hash synthetic bundles and validate seals.</li>
          <li>Confirm notary authority in a signed trust registry.</li>
          <li>Generate immutable-style receipts with canonical hashes.</li>
          <li>Anchor receipt hashes on EVM.</li>
        </ol>
      </div>
    </section >
  );
}
