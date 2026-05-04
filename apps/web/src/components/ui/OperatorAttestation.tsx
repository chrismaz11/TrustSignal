'use client';

import React, { useId } from 'react';

interface OperatorAttestationProps {
  attestationText?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  operatorName?: string;
}

const DEFAULT_ATTESTATION_TEXT =
  'I attest that I am an authorized operator, that I have reviewed the verification request, ' +
  'and that I accept responsibility for this action under applicable regulations. ' +
  'I understand that this system provides verification corroboration and does not replace ' +
  'my professional judgment or legal obligation.';

export function OperatorAttestation({
  attestationText = DEFAULT_ATTESTATION_TEXT,
  checked,
  onChange,
  disabled = false,
  operatorName
}: OperatorAttestationProps) {
  const id = useId();

  return (
    <div className={`attestation-block ${checked ? 'attestation-confirmed' : ''}`}>
      <div className="attestation-header">
        <span className="attestation-title">Operator Attestation Required</span>
        {operatorName && (
          <span className="attestation-operator muted">Attesting as: {operatorName}</span>
        )}
      </div>
      <p className="attestation-text muted">{attestationText}</p>
      <label htmlFor={id} className="attestation-checkbox-label">
        <input
          id={id}
          type="checkbox"
          className="attestation-checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span>I confirm the above attestation and authorize this verification</span>
      </label>
    </div>
  );
}
