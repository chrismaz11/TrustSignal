import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Input({ 
  label, 
  helper, 
  error, 
  className = '', 
  id,
  ...props 
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      />
      {helper && !error && (
        <div className="form-helper">
          {helper}
        </div>
      )}
      {error && (
        <div className="form-helper text-danger">
          {error}
        </div>
      )}
    </div>
  );
}