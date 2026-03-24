export type RegistrySourceCategory =
  | 'sanctions'
  | 'deeds'
  | 'dmv'
  | 'license'
  | 'notary'
  | 'misc';

export const REGISTRY_SOURCE_IDS = [
  'ofac_sdn',
  'ofac_sls',
  'ofac_ssi',
  'hhs_oig_leie',
  'sam_exclusions',
  'uk_sanctions_list',
  'bis_entity_list',
  'bis_unverified_list',
  'bis_military_end_user',
  'us_csl_consolidated',
  'nppes_npi_registry',
  'sec_edgar_company_tickers',
  'fdic_bankfind_institutions'
] as const;

export type RegistrySourceId = typeof REGISTRY_SOURCE_IDS[number];

export type ComplianceState = 'MATCH' | 'NO_MATCH' | 'COMPLIANCE_GAP';

export type RegistryMatch = {
  name: string;
  score: number;
};

export type RegistryVerifyResult = {
  sourceId: RegistrySourceId;
  sourceName: string;
  category: RegistrySourceCategory;
  zkCircuit: string;
  subject: string;
  status: ComplianceState;
  matched: boolean;
  matches: RegistryMatch[];
  checkedAt: string;
  sourceVersion: string | null;
  cached: boolean;
  details?: string;
};

export type RegistryVerifyBatchResult = {
  subject: string;
  generatedAt: string;
  summary: {
    totalSources: number;
    matchedSources: number;
    complianceGapSources: number;
  };
  results: RegistryVerifyResult[];
};

export type RegistryBatchVerifyResult = RegistryVerifyBatchResult;

export type RegistryOracleJobView = {
  id: string;
  sourceId: string;
  zkCircuit: string;
  status: string;
  resultStatus: string | null;
  proofUri: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type RegistrySourceView = {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  zkCircuit: string;
  active: boolean;
  freeTier: boolean;
  fetchIntervalMinutes: number;
  parserVersion: string;
  lastFetchedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
};

export type RegistrySourceSummary = RegistrySourceView;

const OFFICIAL_REGISTRY_SOURCE_NAMES: Record<RegistrySourceId, string> = {
  ofac_sdn: 'U.S. Department of the Treasury - OFAC SDN List',
  ofac_sls: 'U.S. Department of the Treasury - OFAC Non-SDN List',
  ofac_ssi: 'U.S. Department of the Treasury - OFAC SSI List',
  hhs_oig_leie: 'U.S. Department of Health and Human Services - OIG LEIE',
  sam_exclusions: 'U.S. General Services Administration - SAM Exclusions',
  uk_sanctions_list:
    'United Kingdom Office of Financial Sanctions Implementation - Consolidated List',
  bis_entity_list: 'U.S. Department of Commerce BIS Entity List',
  bis_unverified_list: 'U.S. Department of Commerce BIS Unverified List',
  bis_military_end_user:
    'U.S. Department of Commerce BIS Military End User List',
  us_csl_consolidated:
    'U.S. International Trade Administration - Consolidated Screening List',
  nppes_npi_registry:
    'U.S. Centers for Medicare & Medicaid Services - NPPES NPI Registry',
  sec_edgar_company_tickers:
    'U.S. Securities and Exchange Commission - EDGAR',
  fdic_bankfind_institutions:
    'U.S. Federal Deposit Insurance Corporation - BankFind Suite'
};

export function getOfficialRegistrySourceName(
  sourceId: string
): string | undefined {
  return OFFICIAL_REGISTRY_SOURCE_NAMES[sourceId as RegistrySourceId];
}
