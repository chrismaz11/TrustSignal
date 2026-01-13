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

  useEffect(() => {
    // Check for existing session on mount
    const savedOperator = localStorage.getItem('deed-shield-operator');
    if (savedOperator) {
      try {
        const parsedOperator = JSON.parse(savedOperator);
        setOperator(parsedOperator);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse saved operator context:', error);
        localStorage.removeItem('deed-shield-operator');
      }
    }
  }, []);

  const login = (operatorData: OperatorContextType) => {
    setOperator(operatorData);
    setIsAuthenticated(true);
    localStorage.setItem('deed-shield-operator', JSON.stringify(operatorData));
  };

  const logout = () => {
    setOperator(null);
    setIsAuthenticated(false);
    localStorage.removeItem('deed-shield-operator');
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