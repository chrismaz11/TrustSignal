import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient, RegistrySource } from '@prisma/client';

type FetchLike = typeof fetch;

export type RegistrySourceCategory = 'sanctions' | 'deeds' | 'dmv' | 'license' | 'notary' | 'misc';
export type RegistrySourceAccessType = 'API' | 'BULK_DOWNLOAD' | 'PORTAL';
export type ComplianceState = 'MATCH' | 'NO_MATCH' | 'COMPLIANCE_GAP';

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
  'fdic_bankfind_institutions',
  'un_consolidated_sanctions',
  'state_dept_debarred',
  'state_dept_nonproliferation',
  'ncua_credit_unions',
  'finra_brokercheck',
  'fincen_msb',
  'ffiec_nic',
  'gleif_lei',
  'cms_medicare_optout',
  'irs_teos',
  'nyc_acris',
  'canada_sema_sanctions',
  'canada_fintrac_msb',
  'canada_cra_charities',
  'canada_osfi_fri',
  'pacer_federal_courts',
  'canada_bc_registry',
  'canada_corporations_canada'
] as const;

export type RegistrySourceId = typeof REGISTRY_SOURCE_IDS[number];

type ProviderType =
  | 'csv'
  | 'sam_json'
  | 'npi_json'
  | 'sec_tickers_json'
  | 'fdic_json'
  | 'snapshot_csv'
  | 'snapshot_xml'
  | 'snapshot_html'
  | 'generic_search_json'
  | 'gleif_json'
  | 'nyc_acris_json'
  | 'portal_html_search';

type RegistrySourceSeed = {
  id: RegistrySourceId;
  name: string;
  category: RegistrySourceCategory;
  accessType: RegistrySourceAccessType;
  endpointEnv: string;
  endpointDefault: string;
  zkCircuit: string;
  fetchIntervalMinutes: number;
  parserVersion: string;
  providerType: ProviderType;
  officialSourceName: string;
  primarySourceHosts: string[];
  requestAcceptHeader: string;
  authEnv?: string;
  searchParam?: string;
  searchPath?: string;
};

type RegistrySourceView = {
  id: string;
  sourceId: string;
  name: string;
  sourceName: string;
  category: string;
  accessType: RegistrySourceAccessType;
  endpoint: string;
  zkCircuit: string;
  active: boolean;
  freeTier: boolean;
  fetchIntervalMinutes: number;
  parserVersion: string;
  lastFetchedAt: Date | null;
  lastSuccessAt: Date | null;
  lastUpdated: string | null;
  lastError: string | null;
};

type SnapshotRecord = {
  sourceId: RegistrySourceId;
  capturedAt: string;
  sourceVersion: string | null;
  candidates: string[];
};

type RegistrySourceRecord = {
  id: string;
  name: string;
  category: string;
  endpoint: string;
  zkCircuit: string;
  fetchIntervalMinutes: number;
  accessType?: string | null;
};

type RegistryOracleJobRecord = {
  id: string;
  sourceId: string;
  zkCircuit: string;
  status: string;
  resultStatus: string | null;
  proofUri: string | null;
  error: string | null;
  jobType?: string | null;
  snapshotCapturedAt?: Date | null;
  snapshotSourceVersion?: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

type LookupResult = {
  status: ComplianceState;
  matches: RegistryMatch[];
  sourceVersion: string | null;
  details?: string;
  snapshotCapturedAt?: string | null;
  snapshotSourceVersion?: string | null;
};

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

export type RegistryOracleJobView = {
  id: string;
  sourceId: string;
  zkCircuit: string;
  jobType: string;
  status: string;
  resultStatus: string | null;
  proofUri: string | null;
  error: string | null;
  snapshotCapturedAt: string | null;
  snapshotSourceVersion: string | null;
  createdAt: string;
  completedAt: string | null;
};

const SOURCE_SEEDS: RegistrySourceSeed[] = [
  {
    id: 'ofac_sdn',
    name: 'OFAC SDN',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'OFAC_SDN_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/sdn.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC SDN List',
    primarySourceHosts: ['treasury.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'ofac_sls',
    name: 'OFAC SLS (Non-SDN)',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'OFAC_SLS_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/non-sdn.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC Non-SDN List',
    primarySourceHosts: ['treasury.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'ofac_ssi',
    name: 'OFAC Sectoral (SSI)',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'OFAC_SSI_URL',
    endpointDefault: 'https://www.treasury.gov/ofac/downloads/ssi.csv',
    zkCircuit: 'sectoral_restriction_match',
    fetchIntervalMinutes: 360,
    parserVersion: 'ofac-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of the Treasury - OFAC SSI List',
    primarySourceHosts: ['treasury.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'hhs_oig_leie',
    name: 'HHS OIG LEIE',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'OIG_LEIE_URL',
    endpointDefault: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 720,
    parserVersion: 'oig-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Health and Human Services OIG LEIE',
    primarySourceHosts: ['oig.hhs.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'sam_exclusions',
    name: 'SAM Exclusions',
    category: 'sanctions',
    accessType: 'API',
    endpointEnv: 'SAM_EXCLUSIONS_URL',
    endpointDefault: 'https://api.sam.gov/entity-information/v2/entities',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 180,
    parserVersion: 'sam-json-v1',
    providerType: 'sam_json',
    officialSourceName: 'U.S. General Services Administration - SAM.gov',
    primarySourceHosts: ['sam.gov', 'api.sam.gov'],
    requestAcceptHeader: 'application/json',
    authEnv: 'SAM_API_KEY'
  },
  {
    id: 'uk_sanctions_list',
    name: 'UK Sanctions List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'UK_SANCTIONS_CSV_URL',
    endpointDefault: 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 360,
    parserVersion: 'uk-csv-v1',
    providerType: 'csv',
    officialSourceName: 'UK Foreign, Commonwealth & Development Office - UK Sanctions List',
    primarySourceHosts: ['sanctionslist.fcdo.gov.uk', 'fcdo.gov.uk'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_entity_list',
    name: 'BIS Entity List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'BIS_ENTITY_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/entity-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Entity List',
    primarySourceHosts: ['media.bis.gov', 'bis.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_unverified_list',
    name: 'BIS Unverified List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'BIS_UNVERIFIED_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/unverified-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Unverified List',
    primarySourceHosts: ['media.bis.gov', 'bis.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'bis_military_end_user',
    name: 'BIS Military End User List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'BIS_MEU_LIST_URL',
    endpointDefault: 'https://media.bis.gov/sites/default/files/documents/military-end-user-list.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'bis-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. Department of Commerce BIS Military End User List',
    primarySourceHosts: ['media.bis.gov', 'bis.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'us_csl_consolidated',
    name: 'US Consolidated Screening List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'US_CSL_CSV_URL',
    endpointDefault: 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'csl-csv-v1',
    providerType: 'csv',
    officialSourceName: 'U.S. International Trade Administration - Consolidated Screening List',
    primarySourceHosts: ['data.trade.gov', 'trade.gov'],
    requestAcceptHeader: 'text/csv'
  },
  {
    id: 'nppes_npi_registry',
    name: 'NPPES NPI Registry',
    category: 'license',
    accessType: 'API',
    endpointEnv: 'NPPES_NPI_API_URL',
    endpointDefault: 'https://npiregistry.cms.hhs.gov/api/',
    zkCircuit: 'license_status_nonmembership',
    fetchIntervalMinutes: 120,
    parserVersion: 'npi-json-v1',
    providerType: 'npi_json',
    officialSourceName: 'U.S. Centers for Medicare & Medicaid Services - NPPES NPI Registry',
    primarySourceHosts: ['npiregistry.cms.hhs.gov', 'cms.hhs.gov'],
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'sec_edgar_company_tickers',
    name: 'SEC EDGAR Company Tickers',
    category: 'misc',
    accessType: 'API',
    endpointEnv: 'SEC_EDGAR_TICKERS_URL',
    endpointDefault: 'https://www.sec.gov/files/company_tickers.json',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 1440,
    parserVersion: 'sec-edgar-json-v1',
    providerType: 'sec_tickers_json',
    officialSourceName: 'U.S. Securities and Exchange Commission - EDGAR',
    primarySourceHosts: ['sec.gov', 'www.sec.gov'],
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'fdic_bankfind_institutions',
    name: 'FDIC BankFind Institutions',
    category: 'license',
    accessType: 'API',
    endpointEnv: 'FDIC_BANKFIND_URL',
    endpointDefault: 'https://banks.data.fdic.gov/api/institutions',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 720,
    parserVersion: 'fdic-json-v1',
    providerType: 'fdic_json',
    officialSourceName: 'U.S. Federal Deposit Insurance Corporation - BankFind Suite',
    primarySourceHosts: ['banks.data.fdic.gov', 'fdic.gov'],
    requestAcceptHeader: 'application/json'
  },
  {
    id: 'un_consolidated_sanctions',
    name: 'UN Security Council Consolidated List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'UN_CONSOLIDATED_SANCTIONS_URL',
    endpointDefault: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'un-xml-v1',
    providerType: 'snapshot_xml',
    officialSourceName: 'United Nations Security Council - Consolidated Sanctions List',
    primarySourceHosts: ['scsanctions.un.org'],
    requestAcceptHeader: 'application/xml'
  },
  {
    id: 'state_dept_debarred',
    name: 'US State Dept AECA Debarred Parties',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'STATE_DEPT_DEBARRED_URL',
    endpointDefault: 'https://www.pmddtc.state.gov/ddtc_public?id=ddtc_public_portal_debarred_list',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'state-dept-debarred-v1',
    providerType: 'snapshot_xml',
    officialSourceName: 'U.S. Department of State - AECA Debarred Parties',
    primarySourceHosts: ['pmddtc.state.gov', 'state.gov'],
    requestAcceptHeader: 'application/xml,text/html'
  },
  {
    id: 'state_dept_nonproliferation',
    name: 'US State Dept Nonproliferation Sanctions',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'STATE_DEPT_NONPROLIFERATION_URL',
    endpointDefault:
      'https://www.state.gov/key-topics-bureau-of-international-security-and-nonproliferation/nonproliferation-sanctions/',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'state-dept-nonpro-v1',
    providerType: 'snapshot_html',
    officialSourceName: 'U.S. Department of State - Nonproliferation Sanctions',
    primarySourceHosts: ['www.state.gov', 'state.gov'],
    requestAcceptHeader: 'text/html,application/xml'
  },
  {
    id: 'ncua_credit_unions',
    name: 'NCUA Credit Union Registry',
    category: 'license',
    accessType: 'API',
    endpointEnv: 'NCUA_CREDIT_UNIONS_URL',
    endpointDefault: 'https://ncua.gov/api/credit-unions',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 1440,
    parserVersion: 'ncua-json-v1',
    providerType: 'generic_search_json',
    officialSourceName: 'National Credit Union Administration - Credit Union Registry',
    primarySourceHosts: ['ncua.gov', 'www.ncua.gov'],
    requestAcceptHeader: 'application/json',
    searchParam: 'q'
  },
  {
    id: 'finra_brokercheck',
    name: 'FINRA BrokerCheck',
    category: 'license',
    accessType: 'API',
    endpointEnv: 'FINRA_BROKERCHECK_URL',
    endpointDefault: 'https://api.brokercheck.finra.org/search',
    zkCircuit: 'license_status_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'finra-json-v1',
    providerType: 'generic_search_json',
    officialSourceName: 'Financial Industry Regulatory Authority - BrokerCheck',
    primarySourceHosts: ['api.brokercheck.finra.org', 'brokercheck.finra.org', 'finra.org'],
    requestAcceptHeader: 'application/json',
    authEnv: 'FINRA_BROKERCHECK_API_KEY',
    searchParam: 'query'
  },
  {
    id: 'fincen_msb',
    name: 'FinCEN Money Services Business Registry',
    category: 'license',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'FINCEN_MSB_URL',
    endpointDefault: 'https://www.fincen.gov/money-services-business-msb-registration',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'fincen-csv-v1',
    providerType: 'snapshot_csv',
    officialSourceName: 'U.S. Financial Crimes Enforcement Network - MSB Registry',
    primarySourceHosts: ['www.fincen.gov', 'fincen.gov'],
    requestAcceptHeader: 'text/csv,text/html'
  },
  {
    id: 'ffiec_nic',
    name: 'FFIEC National Information Center',
    category: 'license',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'FFIEC_NIC_URL',
    endpointDefault: 'https://www.ffiec.gov/npw/FinancialReport/ReturnFinancialReport',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'ffiec-xml-v1',
    providerType: 'snapshot_xml',
    officialSourceName: 'Federal Financial Institutions Examination Council - National Information Center',
    primarySourceHosts: ['www.ffiec.gov', 'ffiec.gov'],
    requestAcceptHeader: 'application/xml,text/xml'
  },
  {
    id: 'gleif_lei',
    name: 'GLEIF Legal Entity Identifier Registry',
    category: 'misc',
    accessType: 'API',
    endpointEnv: 'GLEIF_LEI_URL',
    endpointDefault: 'https://api.gleif.org/api/v1/lei-records',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 1440,
    parserVersion: 'gleif-json-v1',
    providerType: 'gleif_json',
    officialSourceName: 'Global Legal Entity Identifier Foundation - LEI Registry',
    primarySourceHosts: ['api.gleif.org', 'gleif.org'],
    requestAcceptHeader: 'application/vnd.api+json'
  },
  {
    id: 'cms_medicare_optout',
    name: 'CMS Medicare Opt-Out Providers',
    category: 'license',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'CMS_MEDICARE_OPTOUT_URL',
    endpointDefault:
      'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/opt-out-affidavits',
    zkCircuit: 'license_status_nonmembership',
    fetchIntervalMinutes: 10080,
    parserVersion: 'cms-optout-csv-v1',
    providerType: 'snapshot_csv',
    officialSourceName: 'U.S. Centers for Medicare & Medicaid Services - Medicare Opt-Out Affidavits',
    primarySourceHosts: ['data.cms.gov', 'cms.gov'],
    requestAcceptHeader: 'text/csv,text/html'
  },
  {
    id: 'irs_teos',
    name: 'IRS Tax-Exempt Organization Search / EO BMF',
    category: 'misc',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'IRS_TEOS_URL',
    endpointDefault: 'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'irs-teos-csv-v1',
    providerType: 'snapshot_csv',
    officialSourceName: 'U.S. Internal Revenue Service - Exempt Organizations Business Master File',
    primarySourceHosts: ['www.irs.gov', 'irs.gov'],
    requestAcceptHeader: 'text/csv,text/html'
  },
  {
    id: 'nyc_acris',
    name: 'NYC ACRIS Combined Property Records',
    category: 'deeds',
    accessType: 'API',
    endpointEnv: 'NYC_ACRIS_URL',
    endpointDefault: 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json',
    zkCircuit: 'deed_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'nyc-acris-json-v1',
    providerType: 'nyc_acris_json',
    officialSourceName: 'New York City Department of Finance - ACRIS Real Property Master',
    primarySourceHosts: ['data.cityofnewyork.us'],
    requestAcceptHeader: 'application/json',
    searchParam: '$q'
  },
  {
    id: 'canada_sema_sanctions',
    name: 'Global Affairs Canada Autonomous Sanctions List',
    category: 'sanctions',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'CANADA_SEMA_SANCTIONS_URL',
    endpointDefault:
      'https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml',
    zkCircuit: 'sanctions_nonmembership',
    fetchIntervalMinutes: 1440,
    parserVersion: 'canada-sema-xml-v1',
    providerType: 'snapshot_xml',
    officialSourceName:
      'Global Affairs Canada - Consolidated Canadian Autonomous Sanctions List',
    primarySourceHosts: ['international.gc.ca'],
    requestAcceptHeader: 'application/xml'
  },
  {
    id: 'canada_fintrac_msb',
    name: 'FINTRAC Money Services Business Registry',
    category: 'license',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'CANADA_FINTRAC_MSB_URL',
    endpointDefault: 'https://fintrac-canafe.canada.ca/msb-esm/public/msb-esm-list.aspx',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'fintrac-html-v1',
    providerType: 'snapshot_html',
    officialSourceName: 'Financial Transactions and Reports Analysis Centre of Canada - MSB Registry',
    primarySourceHosts: ['fintrac-canafe.canada.ca'],
    requestAcceptHeader: 'text/html'
  },
  {
    id: 'canada_cra_charities',
    name: 'CRA Canadian Charities Registry',
    category: 'misc',
    accessType: 'API',
    endpointEnv: 'CANADA_CRA_CHARITIES_URL',
    endpointDefault: 'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/api/v1/charities',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'cra-charities-json-v1',
    providerType: 'generic_search_json',
    officialSourceName: 'Canada Revenue Agency - Charities Listings',
    primarySourceHosts: ['apps.cra-arc.gc.ca', 'canada.ca'],
    requestAcceptHeader: 'application/json',
    searchParam: 'q'
  },
  {
    id: 'canada_osfi_fri',
    name: 'OSFI Federally Regulated Financial Institutions List',
    category: 'license',
    accessType: 'BULK_DOWNLOAD',
    endpointEnv: 'CANADA_OSFI_FRI_URL',
    endpointDefault:
      'https://www.osfi-bsif.gc.ca/en/supervision/federally-regulated-financial-institutions',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'osfi-html-v1',
    providerType: 'snapshot_html',
    officialSourceName: 'Office of the Superintendent of Financial Institutions - FRFI List',
    primarySourceHosts: ['www.osfi-bsif.gc.ca', 'osfi-bsif.gc.ca'],
    requestAcceptHeader: 'text/html,text/csv'
  },
  {
    id: 'pacer_federal_courts',
    name: 'PACER Federal Court Records',
    category: 'misc',
    accessType: 'PORTAL',
    endpointEnv: 'PACER_FEDERAL_COURTS_URL',
    endpointDefault: 'https://pcl.uscourts.gov/pcl/pages/search/findCase.jsf',
    zkCircuit: 'litigation_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'pacer-portal-v1',
    providerType: 'portal_html_search',
    officialSourceName: 'Administrative Office of the U.S. Courts - PACER Case Locator',
    primarySourceHosts: ['pcl.uscourts.gov', 'pacer.uscourts.gov', 'uscourts.gov'],
    requestAcceptHeader: 'text/html,application/json',
    authEnv: 'PACER_API_TOKEN',
    searchParam: 'caseSearchText'
  },
  {
    id: 'canada_bc_registry',
    name: 'BC Business Registry',
    category: 'misc',
    accessType: 'API',
    endpointEnv: 'CANADA_BC_REGISTRY_URL',
    endpointDefault: 'https://bcregistry.gov.bc.ca/api/search/businesses',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'bc-registry-json-v1',
    providerType: 'generic_search_json',
    officialSourceName: 'British Columbia Registries and Online Services - Business Registry',
    primarySourceHosts: ['bcregistry.gov.bc.ca'],
    requestAcceptHeader: 'application/json',
    searchParam: 'q'
  },
  {
    id: 'canada_corporations_canada',
    name: 'Corporations Canada Federal Business Registry',
    category: 'misc',
    accessType: 'PORTAL',
    endpointEnv: 'CANADA_CORPORATIONS_CANADA_URL',
    endpointDefault: 'https://ised-isde.canada.ca/cc/lgcy/fdrl/srch/index.html',
    zkCircuit: 'entity_registry_match',
    fetchIntervalMinutes: 10080,
    parserVersion: 'corporations-canada-portal-v1',
    providerType: 'portal_html_search',
    officialSourceName: 'Innovation, Science and Economic Development Canada - Corporations Canada',
    primarySourceHosts: ['ised-isde.canada.ca'],
    requestAcceptHeader: 'text/html',
    searchParam: 'q'
  }
];

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeName(value).split(' ').filter((part) => part.length > 0);
}

function scoreCandidate(subject: string, candidate: string): number {
  const subjectNorm = normalizeName(subject);
  const candidateNorm = normalizeName(candidate);
  if (!subjectNorm || !candidateNorm) return 0;
  if (subjectNorm === candidateNorm) return 1;
  if (candidateNorm.includes(subjectNorm) || subjectNorm.includes(candidateNorm)) return 0.9;

  const a = new Set(tokenize(subjectNorm));
  const b = new Set(tokenize(candidateNorm));
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = new Set<string>([...a, ...b]).size;
  return union === 0 ? 0 : overlap / union;
}

function buildMatches(subject: string, candidates: Iterable<string>): RegistryMatch[] {
  const matchMap = new Map<string, number>();
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const score = scoreCandidate(subject, trimmed);
    if (score >= 0.7) {
      const current = matchMap.get(trimmed) || 0;
      if (score > current) {
        matchMap.set(trimmed, score);
      }
    }
  }

  return [...matchMap.entries()]
    .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

function extractCandidateNames(headers: string[], row: string[]): string[] {
  const byHeader = new Map<string, string>();
  headers.forEach((header, index) => {
    byHeader.set(header, row[index] || '');
  });

  const candidates: string[] = [];
  for (const [header, value] of byHeader.entries()) {
    if (!value) continue;
    if (/(name|entity|individual|organization|aka|alias|company|institution|charity|business|provider)/.test(header)) {
      candidates.push(value);
    }
  }

  const firstName = byHeader.get('first_name') || byHeader.get('firstname') || '';
  const lastName = byHeader.get('last_name') || byHeader.get('lastname') || '';
  if (firstName || lastName) {
    candidates.push(`${firstName} ${lastName}`.trim());
  }

  if (candidates.length === 0 && row.length > 0) {
    candidates.push(row[0]);
  }

  return [...new Set(candidates.map((value) => value.trim()).filter(Boolean))];
}

function extractXmlCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const tagPattern = /<([a-zA-Z0-9:_-]+)[^>]*>([^<]*)<\/\1>/g;
  let match: RegExpExecArray | null;
  let firstName = '';
  let lastName = '';

  while ((match = tagPattern.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    const value = match[2].replace(/\s+/g, ' ').trim();
    if (!value) continue;

    if (/(firstname|givenname|first-name)/.test(tag)) firstName = value;
    if (/(lastname|surname|familyname|last-name)/.test(tag)) lastName = value;

    if (/(name|entity|individual|organization|company|firm|institution|alias)/.test(tag)) {
      candidates.add(value);
    }
  }

  if (firstName || lastName) {
    candidates.add(`${firstName} ${lastName}`.trim());
  }

  return [...candidates];
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(br|p|tr|td|th|li|div|section|article|h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlCandidates(text: string): string[] {
  const tableRows = [...text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const candidates = new Set<string>();

  for (const row of tableRows) {
    const rowText = stripHtml(row[1]);
    if (!rowText) continue;
    const parts = rowText.split(/\s{2,}|\|/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      candidates.add(parts[0]);
    }
  }

  if (candidates.size === 0) {
    const textValue = stripHtml(text);
    const chunks = textValue.split(/[\n;,]/).map((part) => part.trim()).filter(Boolean);
    for (const chunk of chunks) {
      if (chunk.split(' ').length >= 2) {
        candidates.add(chunk);
      }
    }
  }

  return [...candidates];
}

function extractJsonCandidates(value: unknown, keyHint = ''): string[] {
  const candidates = new Set<string>();
  const keyNorm = keyHint.toLowerCase();

  if (typeof value === 'string') {
    if (/(name|entity|organization|company|broker|firm|charity|business|provider|case)/.test(keyNorm)) {
      candidates.add(value);
    }
    return [...candidates];
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      for (const candidate of extractJsonCandidates(entry, keyHint)) {
        candidates.add(candidate);
      }
    }
    return [...candidates];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const firstNameKeys = ['firstName', 'first_name', 'givenName'];
  const lastNameKeys = ['lastName', 'last_name', 'surname', 'familyName'];
  const firstName = firstNameKeys.find((key) => typeof record[key] === 'string');
  const lastName = lastNameKeys.find((key) => typeof record[key] === 'string');
  if (firstName || lastName) {
    candidates.add(`${(record[firstName || ''] as string | undefined) || ''} ${(record[lastName || ''] as string | undefined) || ''}`.trim());
  }

  for (const [key, nested] of Object.entries(record)) {
    if (typeof nested === 'string' && /(name|entity|organization|company|broker|firm|charity|business|provider|case)/i.test(key)) {
      candidates.add(nested);
      continue;
    }
    for (const candidate of extractJsonCandidates(nested, key)) {
      candidates.add(candidate);
    }
  }

  return [...candidates];
}

function sourceEndpoint(seed: RegistrySourceSeed, env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env[seed.endpointEnv] || '').trim();
  return configured || seed.endpointDefault;
}

function subjectHash(sourceId: RegistrySourceId, subject: string): string {
  return createHash('sha256')
    .update(`${sourceId}:${normalizeName(subject)}`)
    .digest('hex');
}

function inputCommitment(
  sourceId: RegistrySourceId,
  subject: string,
  response: Omit<RegistryVerifyResult, 'cached'>
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        sourceId,
        subject: normalizeName(subject),
        status: response.status,
        matches: response.matches,
        checkedAt: response.checkedAt,
        sourceVersion: response.sourceVersion
      })
    )
    .digest('hex');
}

const SOURCE_SEED_BY_ID = new Map<RegistrySourceId, RegistrySourceSeed>(
  SOURCE_SEEDS.map((seed) => [seed.id, seed])
);

export function getOfficialRegistrySourceName(sourceId: string): string | undefined {
  const seed = SOURCE_SEED_BY_ID.get(sourceId as RegistrySourceId);
  return seed?.officialSourceName;
}

function resolveRegistryUserAgent(): string {
  return (process.env.REGISTRY_USER_AGENT || '').trim() || 'TrustSignal-RegistryAdapter/1.0 (compliance@trustsignal.dev)';
}

function resolveTimeoutMs(): number {
  const parsed = Number.parseInt((process.env.REGISTRY_FETCH_TIMEOUT_MS || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return 15000;
  return Math.min(parsed, 60000);
}

function resolveProviderCooldownMs(): number {
  const parsed = Number.parseInt((process.env.REGISTRY_PROVIDER_COOLDOWN_MS || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 300;
  return Math.min(parsed, 5000);
}

function resolveSnapshotRoot(snapshotDir?: string): string {
  return snapshotDir || process.env.REGISTRY_SNAPSHOT_DIR || path.resolve(__dirname, '../..', '.registry-snapshots');
}

function snapshotPath(sourceId: RegistrySourceId, snapshotDir?: string): string {
  return path.join(resolveSnapshotRoot(snapshotDir), `${sourceId}.json`);
}

const providerLastCallAt = new Map<string, number>();

async function applyProviderCooldown(providerKey: string): Promise<void> {
  const minIntervalMs = resolveProviderCooldownMs();
  if (minIntervalMs <= 0) return;
  const now = Date.now();
  const last = providerLastCallAt.get(providerKey) || 0;
  const waitMs = minIntervalMs - (now - last);
  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  providerLastCallAt.set(providerKey, Date.now());
}

function validatePrimarySourceEndpoint(
  seed: RegistrySourceSeed,
  endpoint: string
): { ok: true } | { ok: false; details: string } {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const allowed = seed.primarySourceHosts.some(
      (approvedHost) => host === approvedHost || host.endsWith(`.${approvedHost}`)
    );
    if (allowed) {
      return { ok: true };
    }
    return {
      ok: false,
      details: `endpoint host ${host} is not an approved primary source for ${seed.id}`
    };
  } catch {
    return {
      ok: false,
      details: `invalid endpoint URL configured for ${seed.id}`
    };
  }
}

async function secureFetch(
  url: string,
  options: {
    accept: string;
    method?: string;
    body?: string;
    contentType?: string;
    headers?: Record<string, string>;
  },
  fetchImpl: FetchLike
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: options.accept,
    'user-agent': resolveRegistryUserAgent(),
    ...(options.headers || {})
  };

  if (options.contentType) {
    headers['content-type'] = options.contentType;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveTimeoutMs());
  try {
    return await fetchImpl(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCsvMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  await applyProviderCooldown(source.id);
  const response = await secureFetch(endpoint, { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }
  const csv = await response.text();
  const { headers, rows } = parseCsv(csv);
  if (headers.length === 0 || rows.length === 0) {
    throw new Error('malformed_response');
  }

  const candidates = rows.flatMap((row) => extractCandidateNames(headers, row));
  if (candidates.length === 0) {
    throw new Error('malformed_response');
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchSamMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const apiKey = (env.SAM_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('missing_auth_env:SAM_API_KEY');
  }

  const url = new URL(endpoint);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('legalBusinessName', subject);
  url.searchParams.set('includeSections', 'entityRegistration,exclusions');
  url.searchParams.set('page', '0');
  url.searchParams.set('size', '10');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const entities = ['entityData', 'entities', 'results']
    .flatMap((key) => (Array.isArray(payload[key]) ? payload[key] : []))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object');

  const candidates = entities.flatMap((entity) =>
    [entity.legalBusinessName, entity.entityName, entity.entityRegistrationName]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  );

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchNpiMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  url.searchParams.set('version', '2.1');
  url.searchParams.set('organization_name', subject);
  url.searchParams.set('limit', '25');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  if (!Array.isArray(payload.results)) {
    throw new Error('malformed_response');
  }

  const candidates: string[] = [];
  for (const entry of payload.results) {
    if (!entry || typeof entry !== 'object') continue;
    const asRecord = entry as Record<string, unknown>;
    const basic = asRecord.basic && typeof asRecord.basic === 'object'
      ? asRecord.basic as Record<string, unknown>
      : null;
    const names = [
      typeof basic?.organization_name === 'string' ? basic.organization_name : '',
      `${typeof basic?.first_name === 'string' ? basic.first_name : ''} ${
        typeof basic?.last_name === 'string' ? basic.last_name : ''
      }`.trim()
    ].filter((value) => value.trim().length > 0);
    candidates.push(...names);
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchSecTickerMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  await applyProviderCooldown(source.id);
  const response = await secureFetch(endpoint, { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  const values = Object.values(payload);
  if (values.length === 0) {
    throw new Error('malformed_response');
  }

  const candidates: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const company = value as Record<string, unknown>;
    if (typeof company.title === 'string') candidates.push(company.title);
    if (typeof company.ticker === 'string') candidates.push(company.ticker);
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchFdicMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  const firstToken = tokenize(subject)[0] || subject;
  url.searchParams.set('filters', `NAME:${firstToken.toUpperCase()}*`);
  url.searchParams.set('limit', '50');
  url.searchParams.set('format', 'json');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  if (!Array.isArray(payload.data)) {
    throw new Error('malformed_response');
  }

  const candidates: string[] = [];
  for (const row of payload.data) {
    if (!row || typeof row !== 'object') continue;
    const details = (row as Record<string, unknown>).data;
    if (!details || typeof details !== 'object') continue;
    const name = (details as Record<string, unknown>).NAME;
    if (typeof name === 'string' && name.trim().length > 0) {
      candidates.push(name);
    }
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchGenericSearchJsonMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  if (source.authEnv && !(env[source.authEnv] || '').trim()) {
    throw new Error(`missing_auth_env:${source.authEnv}`);
  }

  const url = new URL(endpoint);
  url.searchParams.set(source.searchParam || 'q', subject);
  url.searchParams.set('limit', '25');

  const headers: Record<string, string> = {};
  if (source.authEnv) {
    headers.authorization = `Bearer ${(env[source.authEnv] || '').trim()}`;
  }

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), {
    accept: source.requestAcceptHeader,
    headers
  }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new Error('malformed_response');
  }

  const candidates = extractJsonCandidates(payload);
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchGleifMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  url.searchParams.set('filter[entity.legalName]', subject);
  url.searchParams.set('page[size]', '25');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('malformed_response');
  }

  const candidates: string[] = [];
  for (const entry of payload.data) {
    if (!entry || typeof entry !== 'object') continue;
    const attributes = (entry as Record<string, unknown>).attributes;
    if (!attributes || typeof attributes !== 'object') continue;
    const entity = (attributes as Record<string, unknown>).entity;
    if (!entity || typeof entity !== 'object') continue;
    const legalName = (entity as Record<string, unknown>).legalName;
    if (legalName && typeof legalName === 'object' && typeof (legalName as Record<string, unknown>).name === 'string') {
      candidates.push((legalName as Record<string, unknown>).name as string);
    }
    const legalAddress = (entity as Record<string, unknown>).otherNames;
    candidates.push(...extractJsonCandidates(legalAddress));
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchNycAcrisMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  const url = new URL(endpoint);
  url.searchParams.set(source.searchParam || '$q', subject);
  url.searchParams.set('$limit', '25');

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), { accept: source.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) {
    throw new Error('malformed_response');
  }

  const candidates = payload.flatMap((entry) => extractJsonCandidates(entry));
  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchPortalHtmlMatches(
  source: RegistrySourceSeed,
  endpoint: string,
  subject: string,
  fetchImpl: FetchLike,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ matches: RegistryMatch[]; sourceVersion: string | null }> {
  if (source.authEnv && !(env[source.authEnv] || '').trim()) {
    throw new Error(`missing_auth_env:${source.authEnv}`);
  }

  const url = new URL(endpoint);
  url.searchParams.set(source.searchParam || 'q', subject);

  const headers: Record<string, string> = {};
  if (source.authEnv) {
    headers.authorization = `Bearer ${(env[source.authEnv] || '').trim()}`;
  }

  await applyProviderCooldown(source.id);
  const response = await secureFetch(url.toString(), {
    accept: source.requestAcceptHeader,
    headers
  }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  const candidates = contentType.includes('json')
    ? extractJsonCandidates(JSON.parse(body))
    : extractHtmlCandidates(body);
  if (candidates.length === 0) {
    throw new Error('malformed_response');
  }

  const sourceVersion = response.headers.get('etag') || response.headers.get('last-modified');
  return { matches: buildMatches(subject, candidates), sourceVersion };
}

async function fetchSnapshotPayload(
  seed: RegistrySourceSeed,
  endpoint: string,
  fetchImpl: FetchLike
): Promise<SnapshotRecord> {
  await applyProviderCooldown(seed.id);
  const response = await secureFetch(endpoint, { accept: seed.requestAcceptHeader }, fetchImpl);
  if (!response.ok) {
    throw new Error(`upstream_http_${response.status}`);
  }

  const body = await response.text();
  if (!body.trim()) {
    throw new Error('malformed_response');
  }

  let candidates: string[] = [];
  if (seed.providerType === 'snapshot_csv') {
    const { headers, rows } = parseCsv(body);
    if (headers.length === 0 || rows.length === 0) {
      throw new Error('malformed_response');
    }
    candidates = rows.flatMap((row) => extractCandidateNames(headers, row));
  } else if (seed.providerType === 'snapshot_xml') {
    candidates = extractXmlCandidates(body);
  } else if (seed.providerType === 'snapshot_html') {
    candidates = extractHtmlCandidates(body);
  }

  const normalizedCandidates = [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
  if (normalizedCandidates.length === 0) {
    throw new Error('malformed_response');
  }

  return {
    sourceId: seed.id,
    capturedAt: new Date().toISOString(),
    sourceVersion: response.headers.get('etag') || response.headers.get('last-modified'),
    candidates: normalizedCandidates
  };
}

async function readSnapshot(
  sourceId: RegistrySourceId,
  snapshotDir?: string
): Promise<SnapshotRecord | null> {
  try {
    const raw = await readFile(snapshotPath(sourceId, snapshotDir), 'utf8');
    return JSON.parse(raw) as SnapshotRecord;
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot: SnapshotRecord, snapshotDir?: string): Promise<void> {
  const filePath = snapshotPath(snapshot.sourceId, snapshotDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot), 'utf8');
}

function snapshotIsFresh(snapshot: SnapshotRecord | null, seed: RegistrySourceSeed): boolean {
  if (!snapshot) return false;
  const capturedAt = Date.parse(snapshot.capturedAt);
  if (!Number.isFinite(capturedAt)) return false;
  return Date.now() - capturedAt < seed.fetchIntervalMinutes * 60 * 1000;
}

async function syncRegistrySources(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  for (const seed of SOURCE_SEEDS) {
    await prisma.registrySource.upsert({
      where: { id: seed.id },
      update: {
        name: seed.officialSourceName,
        category: seed.category,
        accessType: seed.accessType,
        endpoint: sourceEndpoint(seed, env),
        zkCircuit: seed.zkCircuit,
        active: true,
        freeTier: true,
        fetchIntervalMinutes: seed.fetchIntervalMinutes,
        parserVersion: seed.parserVersion
      } as never,
      create: {
        id: seed.id,
        name: seed.officialSourceName,
        category: seed.category,
        accessType: seed.accessType,
        endpoint: sourceEndpoint(seed, env),
        zkCircuit: seed.zkCircuit,
        active: true,
        freeTier: true,
        fetchIntervalMinutes: seed.fetchIntervalMinutes,
        parserVersion: seed.parserVersion
      } as never
    });
  }
}

async function createIngestJob(
  prisma: PrismaClient,
  seed: RegistrySourceSeed
) {
  return prisma.registryOracleJob.create({
    data: {
      sourceId: seed.id,
      subjectHash: createHash('sha256').update(`snapshot:${seed.id}`).digest('hex'),
      zkCircuit: seed.zkCircuit,
      inputCommitment: createHash('sha256').update(`${seed.id}:${Date.now()}`).digest('hex'),
      jobType: 'INGEST',
      status: 'QUEUED',
      resultStatus: null
    } as never
  });
}

async function ensureSourceSnapshot(
  prisma: PrismaClient,
  source: RegistrySourceRecord,
  seed: RegistrySourceSeed,
  fetchImpl: FetchLike,
  snapshotDir?: string
): Promise<SnapshotRecord> {
  const existing = await readSnapshot(seed.id, snapshotDir);
  if (snapshotIsFresh(existing, seed)) {
    return existing as SnapshotRecord;
  }

  const ingestJob = await createIngestJob(prisma, seed);
  try {
    const snapshot = await fetchSnapshotPayload(seed, source.endpoint, fetchImpl);
    await writeSnapshot(snapshot, snapshotDir);
    const capturedAt = new Date(snapshot.capturedAt);
    await prisma.registryOracleJob.update({
      where: { id: ingestJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: capturedAt,
        snapshotCapturedAt: capturedAt,
        snapshotSourceVersion: snapshot.sourceVersion || null
      } as never
    });
    await prisma.registrySource.update({
      where: { id: source.id },
      data: {
        lastFetchedAt: capturedAt,
        lastSuccessAt: capturedAt,
        lastError: null
      }
    });
    return snapshot;
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message.slice(0, 200) : 'snapshot_ingest_failed';
    await prisma.registryOracleJob.update({
      where: { id: ingestJob.id },
      data: {
        status: 'FAILED',
        error: `snapshot ingest failed: ${message}`,
        completedAt: new Date()
      } as never
    });
    await prisma.registrySource.update({
      where: { id: source.id },
      data: {
        lastFetchedAt: new Date(),
        lastError: `snapshot ingest failed: ${message}`
      }
    });
    throw error;
  }
}

function providerUsesSnapshot(seed: RegistrySourceSeed): boolean {
  return seed.providerType === 'snapshot_csv' || seed.providerType === 'snapshot_xml' || seed.providerType === 'snapshot_html';
}

async function runLookup(args: {
  prisma: PrismaClient;
  source: RegistrySourceRecord;
  subject: string;
  fetchImpl: FetchLike;
  env?: NodeJS.ProcessEnv;
  snapshotDir?: string;
}): Promise<LookupResult> {
  const { prisma, source, subject, fetchImpl, env = process.env, snapshotDir } = args;
  const seed = SOURCE_SEED_BY_ID.get(source.id as RegistrySourceId);
  if (!seed) {
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details: `source ${source.id} is not in the primary-source registry catalog`
    };
  }

  const primaryEndpoint = validatePrimarySourceEndpoint(seed, source.endpoint);
  if (!primaryEndpoint.ok) {
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details: 'details' in primaryEndpoint ? primaryEndpoint.details : 'primary_source_endpoint_invalid'
    };
  }

  try {
    if (providerUsesSnapshot(seed)) {
      const snapshot = await ensureSourceSnapshot(prisma, source, seed, fetchImpl, snapshotDir);
      return {
        status: buildMatches(subject, snapshot.candidates).length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: buildMatches(subject, snapshot.candidates),
        sourceVersion: snapshot.sourceVersion,
        snapshotCapturedAt: snapshot.capturedAt,
        snapshotSourceVersion: snapshot.sourceVersion
      };
    }

    if (seed.providerType === 'sam_json') {
      const result = await fetchSamMatches(seed, source.endpoint, subject, fetchImpl, env);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'npi_json') {
      const result = await fetchNpiMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'sec_tickers_json') {
      const result = await fetchSecTickerMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'fdic_json') {
      const result = await fetchFdicMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'gleif_json') {
      const result = await fetchGleifMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'nyc_acris_json') {
      const result = await fetchNycAcrisMatches(seed, source.endpoint, subject, fetchImpl);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'generic_search_json') {
      const result = await fetchGenericSearchJsonMatches(seed, source.endpoint, subject, fetchImpl, env);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    if (seed.providerType === 'portal_html_search') {
      const result = await fetchPortalHtmlMatches(seed, source.endpoint, subject, fetchImpl, env);
      return {
        status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
        matches: result.matches,
        sourceVersion: result.sourceVersion
      };
    }

    const result = await fetchCsvMatches(seed, source.endpoint, subject, fetchImpl);
    return {
      status: result.matches.length > 0 ? 'MATCH' : 'NO_MATCH',
      matches: result.matches,
      sourceVersion: result.sourceVersion
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message.slice(0, 200) : 'primary_source_lookup_failed';
    return {
      status: 'COMPLIANCE_GAP',
      matches: [],
      sourceVersion: null,
      details: `primary source lookup failed: ${message}`
    };
  }
}

async function dispatchOracleJob(
  job: {
    id: string;
    sourceId: string;
    zkCircuit: string;
    inputCommitment: string;
  },
  fetchImpl: FetchLike
): Promise<{ status: string; proofUri?: string; error?: string }> {
  const endpoint = (process.env.ZK_ORACLE_URL || '').trim();
  if (!endpoint) {
    return { status: 'SKIPPED' };
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jobId: job.id,
        sourceId: job.sourceId,
        circuit: job.zkCircuit,
        inputCommitment: job.inputCommitment
      })
    });

    if (!response.ok) {
      return { status: 'FAILED', error: `oracle_http_${response.status}` };
    }

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const proofUri = typeof payload.proofUri === 'string' ? payload.proofUri : undefined;
    return { status: 'DISPATCHED', proofUri };
  } catch {
    return { status: 'FAILED', error: 'oracle_dispatch_failed' };
  }
}

const SOURCES_SYNC_TTL_MS = 60 * 60 * 1000;

export function createRegistryAdapterService(
  prisma: PrismaClient,
  options?: { fetchImpl?: FetchLike; snapshotDir?: string }
) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const snapshotDir = options?.snapshotDir;
  let sourcesReadyAt: number | null = null;
  let syncInFlight: Promise<void> | null = null;

  async function ensureSourcesReady(): Promise<void> {
    const now = Date.now();
    if (sourcesReadyAt !== null && now - sourcesReadyAt < SOURCES_SYNC_TTL_MS) {
      return;
    }
    if (!syncInFlight) {
      syncInFlight = syncRegistrySources(prisma)
        .then(() => {
          sourcesReadyAt = Date.now();
          syncInFlight = null;
        })
        .catch((err) => {
          syncInFlight = null;
          throw err;
        });
    }
    await syncInFlight;
  }

  return {
    async listSources(): Promise<RegistrySourceView[]> {
      await ensureSourcesReady();
      const sources = await prisma.registrySource.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] });
      return sources.map((source) => {
        const seed = SOURCE_SEED_BY_ID.get(source.id as RegistrySourceId);
        const sourceWithAccessType = source as RegistrySource & { accessType?: string | null };
        const accessType = (sourceWithAccessType.accessType as RegistrySourceAccessType | null) || seed?.accessType || 'API';
        const lastUpdated = source.lastSuccessAt || source.lastFetchedAt;
        return {
          id: source.id,
        sourceId: source.id,
        name: source.name,
        sourceName: seed?.name || source.name,
          category: source.category,
          accessType,
          endpoint: source.endpoint,
          zkCircuit: source.zkCircuit,
          active: source.active,
          freeTier: source.freeTier,
          fetchIntervalMinutes: source.fetchIntervalMinutes,
          parserVersion: source.parserVersion,
          lastFetchedAt: source.lastFetchedAt,
          lastSuccessAt: source.lastSuccessAt,
          lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
          lastError: source.lastError
        };
      });
    },

    async verify(input: { sourceId: RegistrySourceId; subject: string; forceRefresh?: boolean }): Promise<RegistryVerifyResult> {
      await ensureSourcesReady();

      const source = await prisma.registrySource.findUnique({ where: { id: input.sourceId } });
      if (!source || !source.active) {
        throw new Error('registry_source_not_found');
      }
      const sourceWithAccessType = source as RegistrySource & { accessType?: string | null };

      const now = new Date();
      const key = subjectHash(input.sourceId, input.subject);
      if (!input.forceRefresh) {
        const cached = await prisma.registryCache.findUnique({
          where: {
            sourceId_subjectHash: {
              sourceId: input.sourceId,
              subjectHash: key
            }
          }
        });

        if (cached && cached.expiresAt > now) {
          const parsed = JSON.parse(cached.responseJson) as Omit<RegistryVerifyResult, 'cached'>;
          return { ...parsed, cached: true };
        }
      }

      const lookup = await runLookup({
        prisma,
        source: {
          id: source.id,
          name: source.name,
          category: source.category,
          endpoint: source.endpoint,
          zkCircuit: source.zkCircuit,
          fetchIntervalMinutes: source.fetchIntervalMinutes,
          accessType: sourceWithAccessType.accessType
        },
        subject: input.subject,
        fetchImpl,
        snapshotDir
      });
      const checkedAt = new Date();
      const response: Omit<RegistryVerifyResult, 'cached'> = {
        sourceId: input.sourceId,
        sourceName: source.name,
        category: source.category as RegistrySourceCategory,
        zkCircuit: source.zkCircuit,
        subject: input.subject,
        status: lookup.status,
        matched: lookup.matches.length > 0,
        matches: lookup.matches,
        checkedAt: checkedAt.toISOString(),
        sourceVersion: lookup.sourceVersion,
        details: lookup.details
      };

      const commitment = inputCommitment(input.sourceId, input.subject, response);
      const job = await prisma.registryOracleJob.create({
        data: {
          sourceId: input.sourceId,
          subjectHash: key,
          zkCircuit: source.zkCircuit,
          inputCommitment: commitment,
          jobType: 'VERIFY',
          status: 'QUEUED',
          resultStatus: response.status,
          snapshotCapturedAt: lookup.snapshotCapturedAt ? new Date(lookup.snapshotCapturedAt) : null,
          snapshotSourceVersion: lookup.snapshotSourceVersion || null
        } as never
      });

      const dispatch = await dispatchOracleJob(
        {
          id: job.id,
          sourceId: input.sourceId,
          zkCircuit: source.zkCircuit,
          inputCommitment: commitment
        },
        fetchImpl
      );

      await prisma.registryOracleJob.update({
        where: { id: job.id },
        data: {
          status: dispatch.status,
          proofUri: dispatch.proofUri || null,
          error: response.status === 'COMPLIANCE_GAP'
            ? response.details || dispatch.error || null
            : dispatch.error || null,
          completedAt: dispatch.status === 'DISPATCHED' ? null : checkedAt
        }
      });

      const expiresAt = new Date(checkedAt.getTime() + source.fetchIntervalMinutes * 60 * 1000);
      await prisma.registryCache.upsert({
        where: {
          sourceId_subjectHash: {
            sourceId: input.sourceId,
            subjectHash: key
          }
        },
        update: {
          responseJson: JSON.stringify(response),
          status: response.status,
          fetchedAt: checkedAt,
          expiresAt,
          sourceVersion: response.sourceVersion || undefined
        },
        create: {
          id: randomUUID(),
          sourceId: input.sourceId,
          subjectHash: key,
          responseJson: JSON.stringify(response),
          status: response.status,
          fetchedAt: checkedAt,
          expiresAt,
          sourceVersion: response.sourceVersion || undefined
        }
      });

      await prisma.registrySource.update({
        where: { id: source.id },
        data: {
          lastFetchedAt: checkedAt,
          lastSuccessAt: response.status === 'COMPLIANCE_GAP' ? source.lastSuccessAt : checkedAt,
          lastError: response.status === 'COMPLIANCE_GAP' ? response.details || 'compliance_gap' : null
        }
      });

      return { ...response, cached: false };
    },

    async verifyBatch(input: { sourceIds: RegistrySourceId[]; subject: string; forceRefresh?: boolean }) {
      const uniqueSources = [...new Set(input.sourceIds)];
      const results = await Promise.all(
        uniqueSources.map((sourceId) =>
          this.verify({ sourceId, subject: input.subject, forceRefresh: input.forceRefresh })
        )
      );
      return {
        subject: input.subject,
        generatedAt: new Date().toISOString(),
        summary: {
          totalSources: results.length,
          matchedSources: results.filter((item) => item.matched).length,
          complianceGapSources: results.filter((item) => item.status === 'COMPLIANCE_GAP').length
        },
        results
      };
    },

    async getOracleJob(jobId: string): Promise<RegistryOracleJobView | null> {
      const job = await prisma.registryOracleJob.findUnique({
        where: { id: jobId }
      });

      if (!job) return null;
      const typedJob = job as RegistryOracleJobRecord;
      return {
        id: typedJob.id,
        sourceId: typedJob.sourceId,
        zkCircuit: typedJob.zkCircuit,
        jobType: typedJob.jobType || 'VERIFY',
        status: typedJob.status,
        resultStatus: typedJob.resultStatus,
        proofUri: typedJob.proofUri,
        error: typedJob.error,
        snapshotCapturedAt: typedJob.snapshotCapturedAt ? typedJob.snapshotCapturedAt.toISOString() : null,
        snapshotSourceVersion: typedJob.snapshotSourceVersion || null,
        createdAt: typedJob.createdAt.toISOString(),
        completedAt: typedJob.completedAt ? typedJob.completedAt.toISOString() : null
      };
    },

    async listOracleJobs(limit = 50): Promise<RegistryOracleJobView[]> {
      const jobs = await prisma.registryOracleJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.min(limit, 200))
      });

      return jobs.map((job) => {
        const typedJob = job as RegistryOracleJobRecord;
        return {
          id: typedJob.id,
          sourceId: typedJob.sourceId,
          zkCircuit: typedJob.zkCircuit,
          jobType: typedJob.jobType || 'VERIFY',
          status: typedJob.status,
          resultStatus: typedJob.resultStatus,
          proofUri: typedJob.proofUri,
          error: typedJob.error,
          snapshotCapturedAt: typedJob.snapshotCapturedAt ? typedJob.snapshotCapturedAt.toISOString() : null,
          snapshotSourceVersion: typedJob.snapshotSourceVersion || null,
          createdAt: typedJob.createdAt.toISOString(),
          completedAt: typedJob.completedAt ? typedJob.completedAt.toISOString() : null
        };
      });
    }
  };
}

export const __testables = {
  SOURCE_SEEDS,
  resetProviderCooldowns() {
    providerLastCallAt.clear();
  },
  async lookupSourceById(input: {
    prisma: PrismaClient;
    sourceId: RegistrySourceId;
    subject: string;
    fetchImpl: FetchLike;
    env?: NodeJS.ProcessEnv;
    endpoint?: string;
    snapshotDir?: string;
  }) {
    const seed = SOURCE_SEED_BY_ID.get(input.sourceId);
    if (!seed) {
      throw new Error(`unknown_source:${input.sourceId}`);
    }
    return runLookup({
      prisma: input.prisma,
      source: {
        id: seed.id,
        name: seed.officialSourceName,
        category: seed.category,
        endpoint: input.endpoint || sourceEndpoint(seed, input.env),
        zkCircuit: seed.zkCircuit,
        fetchIntervalMinutes: seed.fetchIntervalMinutes,
        accessType: seed.accessType
      },
      subject: input.subject,
      fetchImpl: input.fetchImpl,
      env: input.env,
      snapshotDir: input.snapshotDir
    });
  }
};
