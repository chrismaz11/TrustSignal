import React from 'react';
import { DropdownOption } from '../../types';

interface SelectProps<T> extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  label?: string;
  helper?: string;
  error?: string;
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
}

export function Select<T extends string>({ 
  label, 
  helper, 
  error, 
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  className = '', 
  id,
  ...props 
}: SelectProps<T>) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as T);
  };
  
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`select ${error ? 'border-danger' : ''} ${className}`}
        value={value}
        onChange={handleChange}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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