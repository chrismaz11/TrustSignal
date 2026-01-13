import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default: 'badge',
    primary: 'badge badge-primary',
    success: 'badge text-success',
    warning: 'badge text-warning',
    danger: 'badge text-danger',
  };

  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}