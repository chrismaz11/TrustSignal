import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled,
  children, 
  className = '',
  ...props 
}: ButtonProps) {
  const baseClasses = 'button';
  const variantClasses = {
    primary: '',
    secondary: 'button-secondary',
    success: 'button-success',
    warning: 'button-warning',
    danger: 'button-danger',
  };
  
  const sizeClasses = {
    sm: 'text-xs px-3 py-2',
    md: '',
    lg: 'text-base px-6 py-4',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="loading-spinner" />}
      {children}
    </button>
  );
}