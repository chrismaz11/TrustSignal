import { Suspense } from 'react';

import VerifyClient from './VerifyClient';

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="grid">
          <div className="card">
            <h2>Verify bundle</h2>
            <p className="muted">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
