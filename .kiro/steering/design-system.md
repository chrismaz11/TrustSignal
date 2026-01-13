---
inclusion: always
---

# Deed Shield Design System Rules

## Project Context
Deed Shield is a verification and attestation layer for real-estate recording workflows. The UI must reflect a neutral, compliance-focused aesthetic appropriate for regulatory software.

## System Boundaries
- Verification and attestation layer only
- Does NOT store documents
- Does NOT replace notarization or county recording
- Issues verifiable receipts and audit artifacts

## Design Principles

### Visual Identity
- **Neutral & Compliance-Focused**: Regulatory software aesthetic
- **Operational Language**: Precise, non-promotional terminology
- **Trust & Verification**: Visual cues that reinforce process verification
- **Liability Clarity**: Clear distinction between system verification and operator attestation

### Typography
- Use readable fonts appropriate for compliance software
- Maintain consistent hierarchy for headings, body text, and form labels
- Ensure accessibility compliance
- Avoid promotional or marketing language

### Color System
- Neutral colors that convey operational functionality
- Clear status indicators (PASS, FLAG, BLOCK states)
- Maintain sufficient contrast ratios for accessibility
- Avoid bright or consumer-focused colors

### Layout & Spacing
- **Operator Console Layout**: Left intake panel / Right verification panel
- Consistent spacing using design tokens
- Clear visual separation between functional areas
- Appropriate whitespace for document-heavy workflows

## Component Guidelines

### Forms & Inputs
- **Controlled Dropdowns**: Use dropdowns for standardized inputs
- **Clear Labels**: Explicit, unambiguous field labels
- **Validation States**: Clear success/error feedback
- **Required Fields**: Obvious visual indicators

### Status & Feedback
- **PASS/FLAG/BLOCK Outcomes**: Clear, neutral status indicators
- **Verification Receipts**: Copyable hash values and receipt IDs
- **Audit Trails**: Timestamp and operator information clearly displayed

### Navigation & Flow
- **Structured Workflow**: Guide operators through verification steps
- **Progress Indicators**: Show current step in multi-step processes
- **Navigation**: Clear navigation for workflows

## Compliance Terminology Standards
Use precise, operational terminology:
- **Operator Console** (not "Dashboard" or "Admin Panel")
- **Generate Receipt** (not "Create" or "Issue")
- **Verify Receipt** (not "Check" or "Validate")
- **Audit Log** (not "History" or "Activity")
- **Verification Receipt** (not "Certificate" or "Proof")
- **Operator Attestation** (not "Approval" or "Sign-off")
- **Revocation Status** (not "Cancellation" or "Void")

## Figma Integration Rules

### Code Generation
- Treat Figma MCP output (React + Tailwind) as design representation, not final code
- Replace Tailwind utilities with project's design system tokens
- Reuse existing components instead of duplicating functionality
- Maintain 1:1 visual parity with Figma designs

### Component Mapping
- Map Figma components to existing codebase components via Code Connect
- Use consistent naming between Figma and code
- Maintain design system token consistency

### Design Tokens
- Extract colors, spacing, typography from Figma variables
- Apply consistently across all components
- Use semantic naming (primary, secondary, success, warning, error)

## Terminology Standards
Use Figma naming and terminology verbatim:
- **Operator Console** (not "Dashboard" or "Admin Panel")
- **Generate Receipt** (not "Create" or "Issue")
- **Verify Receipt** (not "Check" or "Validate")
- **Audit Log** (not "History" or "Activity")

## Liability and Compliance Language
- Distinguish system verification from operator attestation
- Use neutral, operational language
- Avoid claims of truth or fraud prevention
- Clearly state system boundaries and limitations

## Implementation Guidelines

### React/TypeScript Standards
- Use TypeScript for all components
- Follow existing project patterns for state management
- Maintain existing API contracts
- Use project's preferred styling approach

### Accessibility
- WCAG 2.1 AA compliance minimum
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

### Data Handling
- No document storage
- Minimal, auditable metadata only
- One-way hashing (non-reversible)
- All actions attributable to operator identity

## Quality Checklist
Before considering any UI component complete:
- [ ] Matches Figma design exactly
- [ ] Uses project design tokens
- [ ] Follows compliance UI patterns
- [ ] Accessible to operators
- [ ] Integrates with existing APIs
- [ ] Maintains neutral aesthetic
- [ ] Clear status and feedback states
- [ ] Copyable receipts and hashes
- [ ] Distinguishes system verification from operator attestation