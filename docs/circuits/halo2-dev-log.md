# Halo2 Circuit Dev Log

Purpose: session-by-session engineering log for Halo2 circuit development in TrustSignal.

Primary targets:
- Keep total gate count under `450,000` where feasible.
- Track Merkle-path and nullifier-circuit changes with rationale.
- Record Poseidon parameter choices and constraint-system impact.

## Quick Summary Table

| Session Date (UTC) | Branch / Commit | Circuit Scope | Gate Count (Before -> After) | Delta | Target Status (<450k) | Outcome |
|---|---|---|---|---:|---|---|
| 2026-03-05 | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |

## Session Template

Copy this block for each work session.

```md
## Session: YYYY-MM-DD

### Context
- Branch:
- Commit(s):
- Owner:
- Goal for this session:

### Circuit Scope
- Files touched:
  - circuits/...
  - revocation.rs
  - nullifier.rs
- Modules affected:

### Gate Count Tracking
- Before:
- After:
- Delta:
- Under 450k target? (yes/no):
- If above target, why:

### Merkle Path / Revocation Notes
- Merkle path depth change:
- Inclusion/non-inclusion logic change:
- `revocation.rs` changes:
- Nullifier circuit changes:

### Poseidon Hash Parameter Decisions
- Width (`t`):
- Rate:
- Capacity:
- Full rounds:
- Partial rounds:
- Security/compatibility rationale:

### Constraint System Notes
- Constraint hotspots:
- What broke:
- Root cause:
- Fix applied:
- Residual risk:

### Benchmark Snapshot
- Prover time:
- Verifier time:
- Memory profile:
- Proof size:

### Validation
- Tests run:
- Result:
- Notes on reproducibility:

### Next Actions
1. 
2. 
3. 
```

## Current Open Questions

1. Which circuits can be split to reduce gate pressure without increasing integration risk?
2. Are Poseidon parameters aligned across Halo2 circuits and any external verifier assumptions?
3. Which revocation/nullifier constraints are most likely to regress performance?

## Change Control Notes

- Do not merge major gate-count increases without a written rationale.
- Always log a benchmark snapshot when changing Merkle path or nullifier logic.
- Link related PRs/issues under each session for traceability.
