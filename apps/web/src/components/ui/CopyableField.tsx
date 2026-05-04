'use client';

import React, { useState, useCallback } from 'react';

interface CopyableFieldProps {
  value: string;
  label?: string;
  mono?: boolean;
  truncate?: boolean;
  className?: string;
}

export function CopyableField({ value, label, mono = true, truncate = false, className = '' }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <div className={`copyable-field ${className}`}>
      {label && <span className="copyable-label form-label">{label}</span>}
      <div className="copyable-row">
        <span className={`copyable-value ${mono ? 'mono' : ''} ${truncate ? 'copyable-truncate' : ''}`}>
          {value}
        </span>
        <button
          type="button"
          className="copyable-btn"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label ?? 'value'}`}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="4" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M1 5h2v7h7v2H1V5z" fill="currentColor"/>
            </svg>
          )}
          <span className="copyable-feedback">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
