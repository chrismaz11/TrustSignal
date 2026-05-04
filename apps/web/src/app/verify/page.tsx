import { Suspense } from 'react';

import { OperatorConsole } from '../../components/OperatorConsole';

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="card"><p className="muted">Loading Operator Console…</p></div>}>
      <OperatorConsole />
    </Suspense>
  );
}
