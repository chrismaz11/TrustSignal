import { 
  TransactionType, 
  RONProvider, 
  USState, 
  PolicyProfile, 
  DropdownOption 
} from '../types';

export const TRANSACTION_TYPE_OPTIONS: DropdownOption<TransactionType>[] = [
  {
    value: 'warranty_deed',
    label: 'Warranty Deed',
    description: 'General warranty deed with full covenants'
  },
  {
    value: 'quitclaim_deed',
    label: 'Quitclaim Deed',
    description: 'Deed without warranties or covenants'
  },
  {
    value: 'trust_deed',
    label: 'Trust Deed',
    description: 'Deed of trust for secured transactions'
  },
  {
    value: 'mortgage',
    label: 'Mortgage',
    description: 'Mortgage document for property financing'
  },
  {
    value: 'reconveyance',
    label: 'Reconveyance',
    description: 'Document releasing trust deed or mortgage'
  },
  {
    value: 'assignment',
    label: 'Assignment',
    description: 'Assignment of mortgage or trust deed'
  }
];

export const RON_PROVIDER_OPTIONS: DropdownOption<RONProvider>[] = [
  {
    value: 'RON-1',
    label: 'RON-1',
    description: 'Primary RON provider for testing'
  },
  {
    value: 'DocuSign',
    label: 'DocuSign',
    description: 'DocuSign remote online notarization'
  },
  {
    value: 'NotaryCam',
    label: 'NotaryCam',
    description: 'NotaryCam remote notarization platform'
  },
  {
    value: 'Pavaso',
    label: 'Pavaso',
    description: 'Pavaso digital closing platform'
  },
  {
    value: 'SIGNiX',
    label: 'SIGNiX',
    description: 'SIGNiX digital signature and notarization'
  }
];

export const US_STATE_OPTIONS: DropdownOption<USState>[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' }
];

export const POLICY_PROFILE_OPTIONS: DropdownOption<PolicyProfile>[] = [
  {
    value: 'STANDARD_CA',
    label: 'Standard California',
    description: 'Standard verification profile for California'
  },
  {
    value: 'STANDARD_TX',
    label: 'Standard Texas',
    description: 'Standard verification profile for Texas'
  },
  {
    value: 'STANDARD_FL',
    label: 'Standard Florida',
    description: 'Standard verification profile for Florida'
  },
  {
    value: 'ENHANCED_FRAUD_DETECTION',
    label: 'Enhanced Fraud Detection',
    description: 'Enhanced verification with additional fraud checks'
  },
  {
    value: 'COUNTY_SPECIFIC',
    label: 'County Specific',
    description: 'County-specific verification requirements'
  },
  {
    value: 'TITLE_COMPANY_PREMIUM',
    label: 'Title Company Premium',
    description: 'Premium verification profile for title companies'
  }
];