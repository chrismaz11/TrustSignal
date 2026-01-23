
export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskSignal {
  id: string;
  description: string;
  severity: RiskBand;
}

export interface DocumentRisk {
  score: number; // 0.0 to 1.0 (1.0 = Max Risk)
  band: RiskBand;
  signals: RiskSignal[];
}

export interface RiskEngineOptions {
  checkForensics?: boolean;
  checkLayout?: boolean;
  checkPolicies?: boolean;
}
