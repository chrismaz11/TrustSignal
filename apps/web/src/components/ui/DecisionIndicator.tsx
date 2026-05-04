import React from 'react';

type Decision = 'ALLOW' | 'FLAG' | 'BLOCK';

interface DecisionIndicatorProps {
  decision: Decision;
  riskScore: number;
  reasons: string[];
  className?: string;
}

const DECISION_CONFIG: Record<Decision, { label: string; className: string; description: string }> = {
  ALLOW: {
    label: 'PASS',
    className: 'decision-pass',
    description: 'Verification complete — no issues detected.'
  },
  FLAG: {
    label: 'FLAG',
    className: 'decision-flag',
    description: 'Verification complete — review required before proceeding.'
  },
  BLOCK: {
    label: 'BLOCK',
    className: 'decision-block',
    description: 'Verification failed — this document should not be processed.'
  }
};

export function DecisionIndicator({ decision, riskScore, reasons, className = '' }: DecisionIndicatorProps) {
  const config = DECISION_CONFIG[decision];

  return (
    <div className={`decision-indicator ${config.className} ${className}`}>
      <div className="decision-badge-row">
        <span className={`decision-badge ${config.className}`}>{config.label}</span>
        <span className="decision-risk-score">
          Risk Score: <strong>{riskScore}</strong>
        </span>
      </div>
      <p className="decision-description">{config.description}</p>
      {reasons.length > 0 && (
        <ul className="decision-reasons">
          {reasons.map((reason, i) => (
            <li key={i} className="decision-reason">{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
