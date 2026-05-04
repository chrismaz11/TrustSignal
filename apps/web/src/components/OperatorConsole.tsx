'use client';

import React, { useState } from 'react';
import { ReceiptGeneratorPanel } from './ReceiptGeneratorPanel';
import { VerificationPanel } from './VerificationPanel';
import { AuthenticationWrapper } from './ui/AuthenticationWrapper';
import { OperatorProvider } from '../contexts/OperatorContext';
import { VerificationResult } from '../types';

export function OperatorConsole() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleResult = (r: VerificationResult) => {
    setResult(r);
    setError(null);
  };

  const handleError = (msg: string) => {
    setError(msg || null);
  };

  return (
    <OperatorProvider>
      <AuthenticationWrapper>
        <div className="operator-console">
          <div className="console-grid">
            <ReceiptGeneratorPanel
              onResult={handleResult}
              onError={handleError}
              loading={loading}
              setLoading={setLoading}
            />
            <VerificationPanel
              result={result}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </AuthenticationWrapper>
    </OperatorProvider>
  );
}
