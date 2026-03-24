export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskSignal {
  id: string;
  description: string;
  severity: RiskBand;
}

export interface DocumentRisk {
  score: number;
  band: RiskBand;
  signals: RiskSignal[];
}
