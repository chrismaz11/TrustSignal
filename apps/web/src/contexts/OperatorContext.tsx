'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { OperatorContext as OperatorContextType } from '../types';

interface OperatorState {
  operator: OperatorContextType | null;
  isAuthenticated: boolean;
  login: (operator: OperatorContextType) => void;
  logout: () => void;
}

const OperatorContext = createContext<OperatorState | undefined>(undefined);

export function useOperator() {
  const context = useContext(OperatorContext);
  if (context === undefined) {
    throw new Error('useOperator must be used within an OperatorProvider');
  }
  return context;
}

interface OperatorProviderProps {
  children: ReactNode;
}

export function OperatorProvider({ children }: OperatorProviderProps) {
  const [operator, setOperator] = useState<OperatorContextType | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const storageKey = 'trustsignal-operator';
  const legacyStorageKey = 'deed-shield-operator';

  useEffect(() => {
    // Check for existing session on mount and migrate legacy branding.
    const savedOperator = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
    if (savedOperator) {
      try {
        const parsedOperator = JSON.parse(savedOperator);
        setOperator(parsedOperator);
        setIsAuthenticated(true);
        localStorage.setItem(storageKey, JSON.stringify(parsedOperator));
        localStorage.removeItem(legacyStorageKey);
      } catch (error) {
        console.error('Failed to parse saved operator context:', error);
        localStorage.removeItem(storageKey);
        localStorage.removeItem(legacyStorageKey);
      }
    }
  }, []);

  const login = (operatorData: OperatorContextType) => {
    setOperator(operatorData);
    setIsAuthenticated(true);
    localStorage.setItem(storageKey, JSON.stringify(operatorData));
    localStorage.removeItem(legacyStorageKey);
  };

  const logout = () => {
    setOperator(null);
    setIsAuthenticated(false);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(legacyStorageKey);
  };

  const value: OperatorState = {
    operator,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}
