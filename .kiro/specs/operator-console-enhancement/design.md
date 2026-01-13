# Design Document

## Overview

The Operator Console Enhancement transforms the existing Deed Shield verification interface into a compliance-focused system that matches the Figma design specifications. The design maintains all existing backend functionality while implementing a two-panel layout for document verification workflows used by notaries, title companies, and county recorders.

## System Boundaries

Deed Shield operates as a verification and attestation layer that:
- Verifies RON bundle processes and produces receipts
- Issues verifiable receipts and audit artifacts
- Does NOT store documents
- Does NOT replace notarization
- Does NOT replace county recording systems
- Does NOT adjudicate legal ownership

## Liability Framework

- **Human Attestation**: Operator responsibility and accountability
- **System Verification**: Process corroboration, not truth assertion
- **Output Classification**: Clear distinction between verified process, operator confirmation, and flagged inconsistencies

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Operator Console (Frontend)"
        A[Authentication Layer]
        B[Operator Context]
        C[Receipt Generator Panel]
        D[Verification Panel]
        E[Audit Log View]
    end
    
    subgraph "Existing Backend APIs"
        F[/api/v1/verify]
        G[/api/v1/receipts]
        H[/api/v1/receipt/{id}]
        I[/api/v1/anchor/{id}]
        J[/api/v1/synthetic]
    end
    
    subgraph "Configuration Management"
        K[Environment Config]
        L[Operator Profiles]
        M[Tenant Settings]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    C --> F
    C --> J
    D --> H
    D --> I
    E --> G
    K --> A
    L --> B
    M --> B
```

### Component Architecture

The system follows a layered architecture with separation of concerns:

1. **Presentation Layer**: React components implementing the Figma design
2. **State Management Layer**: React Context for operator and verification state
3. **API Integration Layer**: Existing backend API calls with error handling
4. **Configuration Layer**: Environment and tenant-specific settings

## Compliance Architecture

### Auditability Requirements
Every verification produces:
- Timestamp
- Operator context
- Deterministic result (PASS / FLAG / REVOKED)
- Exportable audit logs

### Vanta Preparation Structure
System structured for future Vanta monitoring of:
- Access controls
- Change management
- Audit logs
- Security policies

## Components and Interfaces

### Core Components

#### OperatorConsole
Main container component implementing the two-panel layout from Figma.

```typescript
interface OperatorConsoleProps {
  operator: OperatorContext;
  onLogout: () => void;
}

interface OperatorContext {
  operatorId: string;
  name: string;
  role: 'notary' | 'title_company' | 'county_recorder';
  tenantId: string;
  permissions: string[];
}
```

#### ReceiptGeneratorPanel
Left panel component for document intake and verification initiation.

```typescript
interface ReceiptGeneratorPanelProps {
  onVerificationSubmit: (bundle: RONBundle, attestation: OperatorAttestation) => void;
  loading: boolean;
}

interface RONBundle {
  bundleId: string;
  transactionType: TransactionType;
  ron: {
    provider: RONProvider;
    notaryId: string;
    commissionState: USState;
    sealPayload: string;
  };
  doc: { docHash: string };
  policy: { profile: PolicyProfile };
}

interface OperatorAttestation {
  operatorId: string;
  timestamp: string;
  attestationText: string;
  confirmed: boolean;
}
```

#### VerificationPanel
Right panel component displaying verification results and receipt details.

```typescript
interface VerificationPanelProps {
  result: VerificationResult | null;
  onAnchor: () => void;
  onCopyHash: (hash: string) => void;
  onDownloadReceipt: () => void;
}

interface VerificationResult {
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  reasons: string[];
  riskScore: number;
  receiptId: string;
  receiptHash: string;
  anchor: AnchorStatus;
  operator: OperatorContext;
  timestamp: string;
  attestation: OperatorAttestation;
}
```

#### AuditLogView
Comprehensive audit log with filtering and export capabilities.

```typescript
interface AuditLogViewProps {
  entries: AuditEntry[];
  filters: AuditFilters;
  onFilterChange: (filters: AuditFilters) => void;
  onExport: (format: 'csv' | 'pdf') => void;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  operator: OperatorContext;
  action: 'verification' | 'anchor' | 'export';
  bundleId: string;
  decision?: 'ALLOW' | 'FLAG' | 'BLOCK';
  receiptId?: string;
  details: Record<string, any>;
}
```

### Controlled Input Components

#### DropdownSelect
Standardized dropdown component for controlled inputs.

```typescript
interface DropdownSelectProps<T> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}

interface DropdownOption<T> {
  value: T;
  label: string;
  description?: string;
}
```

### Configuration Interfaces

#### EnvironmentConfig
Environment-specific configuration management.

```typescript
interface EnvironmentConfig {
  apiBaseUrl: string;
  environment: 'development' | 'staging' | 'production';
  tenantId: string;
  authConfig: {
    provider: 'cognito' | 'auth0';
    clientId: string;
    domain: string;
  };
  features: {
    anchoring: boolean;
    auditExport: boolean;
    multiTenant: boolean;
  };
}
```

## Data Models

### Data Handling Constraints

#### Document Storage
- No storage of uploaded documents
- Hashing is one-way and non-reversible
- Metadata retained is minimal and auditable
- All actions attributable to operator identity

#### Audit Requirements
- Timestamp for every verification
- Operator context for every action
- Deterministic results (PASS / FLAG / REVOKED)
- Exportable audit logs for compliance

```typescript
interface EnhancedVerifyInput extends VerifyInput {
  operator: OperatorContext;
  attestation: OperatorAttestation;
  clientMetadata: {
    userAgent: string;
    ipAddress: string;
    sessionId: string;
  };
}

interface EnhancedVerifyResponse extends VerifyResponse {
  operator: OperatorContext;
  attestation: OperatorAttestation;
  auditTrail: {
    submittedAt: string;
    processedAt: string;
    processingTimeMs: number;
  };
}
```

### Dropdown Option Models

Standardized options for controlled inputs:

```typescript
type TransactionType = 
  | 'warranty_deed'
  | 'quitclaim_deed'
  | 'trust_deed'
  | 'mortgage'
  | 'reconveyance'
  | 'assignment';

type RONProvider = 
  | 'RON-1'
  | 'DocuSign'
  | 'NotaryCam'
  | 'Pavaso'
  | 'SIGNiX';

type USState = 
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

type PolicyProfile = 
  | 'STANDARD_CA'
  | 'STANDARD_TX'
  | 'STANDARD_FL'
  | 'ENHANCED_FRAUD_DETECTION'
  | 'COUNTY_SPECIFIC'
  | 'TITLE_COMPANY_PREMIUM';
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Now I need to analyze the acceptance criteria to determine which ones can be tested as properties:

<function_calls>
<invoke name="prework">
<parameter name="featureName">operator-console-enhancement

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated:

- **Dropdown Properties (2.1-2.4)**: All dropdown components follow the same pattern and can be tested with a single comprehensive property
- **Copy Functionality (5.1-5.2)**: Both receipt hash and ID copying follow the same pattern
- **Attestation Properties (3.1, 3.3-3.5)**: Multiple attestation-related properties can be consolidated
- **Responsive Layout (9.4-9.5)**: Layout behavior at different breakpoints follows consistent patterns

### Correctness Properties

Property 1: Dropdown options consistency
*For any* dropdown component (transaction types, RON providers, commission states, policy profiles), the rendered options should match the predefined valid options for that dropdown type
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Form validation prevents invalid submission
*For any* form submission attempt, if required fields are missing or attestation is not provided, the submission should be prevented and appropriate validation messages displayed
**Validates: Requirements 2.5, 3.1, 3.3**

Property 3: Operator context persistence
*For any* user session, operator context (ID, name, role, permissions) should remain consistent across all interface interactions and be displayed in the UI
**Validates: Requirements 7.2, 7.3**

Property 4: Copy functionality works correctly
*For any* copyable element (receipt hash, receipt ID), clicking the copy button should copy the correct value to clipboard and show visual confirmation
**Validates: Requirements 5.1, 5.2, 5.3**

Property 5: Audit trail completeness
*For any* verification action, the audit log should record operator identification, timestamp, and attestation status
**Validates: Requirements 3.5, 6.2, 6.3**

Property 6: Visual styling consistency
*For any* screen or component, the applied CSS classes and computed styles should match the design system specifications
**Validates: Requirements 1.3, 5.4**

Property 7: Verification results display correctly
*For any* verification result, the decision indicator, risk score, and reasons should be displayed with appropriate styling and formatting
**Validates: Requirements 4.4, 4.5**

Property 8: Responsive layout behavior
*For any* screen size, the layout should maintain two-panel design above 1024px width and stack vertically below that breakpoint
**Validates: Requirements 9.4, 9.5**

Property 9: Error handling and retry functionality
*For any* network error or failed verification, appropriate error messages should be displayed and retry functionality should be available
**Validates: Requirements 10.3, 10.5**

Property 10: Authentication and authorization
*For any* user access attempt, authentication should be required and role-based permissions should be enforced
**Validates: Requirements 7.1, 7.4**

Property 11: Configuration environment handling
*For any* deployment environment, the appropriate configuration should be loaded and tenant-specific settings should be applied
**Validates: Requirements 8.1, 8.4**

Property 12: Loading state management
*For any* asynchronous operation (verification, anchoring, data loading), loading indicators should be displayed during processing
**Validates: Requirements 10.2**

Property 13: Audit log filtering and sorting
*For any* audit log view, entries should be displayed in chronological order and filtering should work correctly across all filter types
**Validates: Requirements 6.1, 6.4**

Property 14: Export functionality
*For any* export operation (audit log, receipt details), the export should trigger correctly and provide appropriate file formats
**Validates: Requirements 5.5, 6.5**

## Error Handling

### Network Error Handling
- **Connection Failures**: Display user-friendly error messages with retry options
- **Timeout Handling**: Implement progressive timeout with clear feedback
- **API Error Responses**: Parse and display meaningful error messages from backend

### Validation Error Handling
- **Form Validation**: Real-time validation with clear error indicators
- **Dropdown Validation**: Prevent invalid selections with helpful guidance
- **Attestation Validation**: Clear messaging about required attestation

### State Error Handling
- **Session Expiry**: Graceful handling with re-authentication prompts
- **Context Loss**: Automatic recovery of operator context where possible
- **Data Inconsistency**: Validation and correction of inconsistent states

## Testing Strategy

### Dual Testing Approach
The system will use both unit testing and property-based testing for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs using React Testing Library and Jest

### Property-Based Testing Configuration
- **Testing Library**: Jest with React Testing Library for DOM testing
- **Minimum Iterations**: 100 iterations per property test
- **Test Tags**: Each property test tagged with **Feature: operator-console-enhancement, Property {number}: {property_text}**

### Unit Testing Focus Areas
- **Component Rendering**: Specific examples of component states
- **User Interactions**: Click handlers, form submissions, navigation
- **Edge Cases**: Empty states, error conditions, boundary values
- **Integration Points**: API calls, authentication flows, configuration loading

### Property Testing Focus Areas
- **Universal Behaviors**: Properties that hold across all valid inputs
- **State Consistency**: Operator context, form validation, audit trails
- **UI Consistency**: Styling, layout behavior, responsive design
- **Data Integrity**: Copy functionality, export operations, filtering

### Testing Environment Setup
- **Mock API Responses**: Consistent test data for verification results
- **Authentication Mocking**: Simulated operator contexts and roles
- **Responsive Testing**: Automated viewport testing for different screen sizes
- **Accessibility Testing**: WCAG compliance validation

### Continuous Integration
- **Pre-commit Hooks**: Run unit tests and linting before commits
- **Pull Request Validation**: Full test suite including property tests
- **Deployment Testing**: Smoke tests in staging environment
- **Performance Monitoring**: Core Web Vitals tracking in production