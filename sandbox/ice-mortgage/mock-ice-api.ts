/**
 * Mock ICE Mortgage Technology (Encompass) API
 *
 * Simulates the Encompass Developer Connect loan data endpoints used in a
 * real integration. Returns realistic mortgage closing data for sandbox testing.
 *
 * No real ICE credentials or network access required.
 */

export type EncompassLoan = {
  loanNumber: string;
  borrowerName: string;
  propertyAddress: string;
  city: string;
  state: string;
  county: string;
  parcelId: string;
  closingDate: string;
  loanAmount: number;
  transactionType: 'PurchaseMoney' | 'Refinance' | 'QuitClaim';
  eClosing: {
    ronSessionId: string;
    notaryId: string;
    notaryName: string;
    notaryCommissionState: string;
    notaryCommissionExpiry: string;
    ronProvider: string;
    sealPayload: string;
    sealScheme: string;
    sessionStatus: 'COMPLETED' | 'PENDING' | 'FAILED';
  };
  documentHash: string;
  pdfBase64?: string;
};

// Realistic synthetic loan fixtures — no real borrower PII
const LOANS: Record<string, EncompassLoan> = {
  // Scenario 1: Clean closing — all fields valid, notary commission matches state
  'LOAN-2026-001': {
    loanNumber: 'LOAN-2026-001',
    borrowerName: 'J. Smith (Test Borrower)',
    propertyAddress: '1234 Maple Street',
    city: 'Chicago',
    state: 'IL',
    county: 'Cook County',
    parcelId: 'PARCEL-IL-COOK-0042',
    closingDate: '2026-04-10T14:00:00Z',
    loanAmount: 485000,
    transactionType: 'PurchaseMoney',
    eClosing: {
      ronSessionId: 'RON-SESSION-001',
      notaryId: 'NOTARY-IL-4421',
      notaryName: 'M. Rivera (Test Notary)',
      notaryCommissionState: 'IL',
      notaryCommissionExpiry: '2028-06-01T00:00:00Z',
      ronProvider: 'RON-1',
      sealPayload: '__DERIVED__',
      sealScheme: 'SIM-ECDSA-v1',
      sessionStatus: 'COMPLETED'
    },
    documentHash: '__DERIVED__'
  },

  // Scenario 2: Notary commission state mismatch — notary licensed in CA, closing in IL
  'LOAN-2026-002': {
    loanNumber: 'LOAN-2026-002',
    borrowerName: 'T. Johnson (Test Borrower)',
    propertyAddress: '789 Oak Avenue',
    city: 'Chicago',
    state: 'IL',
    county: 'Cook County',
    parcelId: 'PARCEL-IL-COOK-0099',
    closingDate: '2026-04-11T10:00:00Z',
    loanAmount: 320000,
    transactionType: 'Refinance',
    eClosing: {
      ronSessionId: 'RON-SESSION-002',
      notaryId: 'NOTARY-CA-9901',
      notaryName: 'D. Park (Test Notary)',
      notaryCommissionState: 'CA',   // mismatch: closing in IL
      notaryCommissionExpiry: '2027-03-15T00:00:00Z',
      ronProvider: 'RON-1',
      sealPayload: '__DERIVED__',
      sealScheme: 'SIM-ECDSA-v1',
      sessionStatus: 'COMPLETED'
    },
    documentHash: '__DERIVED__'
  },

  // Scenario 3: Tampered seal payload — should fail signature verification
  'LOAN-2026-003': {
    loanNumber: 'LOAN-2026-003',
    borrowerName: 'K. Williams (Test Borrower)',
    propertyAddress: '55 Elm Court',
    city: 'Austin',
    state: 'TX',
    county: 'Travis County',
    parcelId: 'PARCEL-TX-TRAVIS-0512',
    closingDate: '2026-04-09T09:30:00Z',
    loanAmount: 610000,
    transactionType: 'PurchaseMoney',
    eClosing: {
      ronSessionId: 'RON-SESSION-003',
      notaryId: 'NOTARY-TX-7712',
      notaryName: 'A. Nguyen (Test Notary)',
      notaryCommissionState: 'TX',
      notaryCommissionExpiry: '2029-01-20T00:00:00Z',
      ronProvider: 'RON-1',
      sealPayload: 'v1:0xdeadbeef_tampered_seal_do_not_trust',  // bad seal
      sealScheme: 'SIM-ECDSA-v1',
      sessionStatus: 'COMPLETED'
    },
    documentHash: '__DERIVED__'
  },

  // Scenario 4: Duplicate submission — same loan re-submitted (rapid re-close attempt)
  'LOAN-2026-004': {
    loanNumber: 'RAPID-LOAN-2026-001',  // RAPID- prefix triggers duplicate risk flag
    borrowerName: 'J. Smith (Test Borrower)',
    propertyAddress: '1234 Maple Street',
    city: 'Chicago',
    state: 'IL',
    county: 'Cook County',
    parcelId: 'PARCEL-IL-COOK-0042',   // same parcel as LOAN-2026-001
    closingDate: '2026-04-10T16:45:00Z',
    loanAmount: 485000,
    transactionType: 'PurchaseMoney',
    eClosing: {
      ronSessionId: 'RON-SESSION-004',
      notaryId: 'NOTARY-IL-4421',
      notaryName: 'M. Rivera (Test Notary)',
      notaryCommissionState: 'IL',
      notaryCommissionExpiry: '2028-06-01T00:00:00Z',
      ronProvider: 'RON-1',
      sealPayload: '__DERIVED__',
      sealScheme: 'SIM-ECDSA-v1',
      sessionStatus: 'COMPLETED'
    },
    documentHash: '__DERIVED__'
  },

  // Scenario 5: Clean closing for revocation flow — verified then revoked
  'LOAN-2026-005': {
    loanNumber: 'LOAN-2026-005',
    borrowerName: 'B. Garcia (Test Borrower)',
    propertyAddress: '200 Pine Boulevard',
    city: 'Miami',
    state: 'FL',
    county: 'Miami-Dade County',
    parcelId: 'PARCEL-FL-MDADE-1103',
    closingDate: '2026-04-08T13:00:00Z',
    loanAmount: 750000,
    transactionType: 'PurchaseMoney',
    eClosing: {
      ronSessionId: 'RON-SESSION-005',
      notaryId: 'NOTARY-FL-2280',
      notaryName: 'C. Thompson (Test Notary)',
      notaryCommissionState: 'FL',
      notaryCommissionExpiry: '2027-09-30T00:00:00Z',
      ronProvider: 'RON-1',
      sealPayload: '__DERIVED__',
      sealScheme: 'SIM-ECDSA-v1',
      sessionStatus: 'COMPLETED'
    },
    documentHash: '__DERIVED__'
  }
};

export function getLoan(loanNumber: string): EncompassLoan | null {
  return LOANS[loanNumber] ?? null;
}

export function getAllLoans(): EncompassLoan[] {
  return Object.values(LOANS);
}

export function getLoanNumbers(): string[] {
  return Object.keys(LOANS);
}
