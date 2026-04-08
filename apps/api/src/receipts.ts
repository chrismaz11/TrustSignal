/**
 * receipts.ts — canonical receipt status types and mapping.
 *
 * The external status enum is frozen at the pilot boundary:
 *   clean | failure | revoked | compliance_gap
 *
 * Internal decision codes (ALLOW / FLAG / BLOCK) must never appear in
 * public-facing API responses. Always map through mapInternalStatusToExternal.
 */

export type ExternalReceiptStatus = 'clean' | 'failure' | 'revoked' | 'compliance_gap';

/**
 * Map the internal verification decision + revocation state to the frozen
 * external status enum exposed on all pilot-facing routes.
 *
 * Mapping:
 *   revoked (any decision)  → 'revoked'
 *   ALLOW                   → 'clean'
 *   BLOCK                   → 'failure'
 *   FLAG                    → 'compliance_gap'
 */
export function mapInternalStatusToExternal(
  decision: 'ALLOW' | 'FLAG' | 'BLOCK',
  revoked = false
): ExternalReceiptStatus {
  if (revoked) return 'revoked';
  if (decision === 'ALLOW') return 'clean';
  if (decision === 'BLOCK') return 'failure';
  return 'compliance_gap';
}
