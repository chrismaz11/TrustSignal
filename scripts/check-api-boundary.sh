#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TARGETS=(
  "api"
  "apps/api/src/server.ts"
  "apps/api/src/lib"
  "apps/api/src/receiptPdf.ts"
  "apps/api/src/security.ts"
  "apps/api/src/db.ts"
  "apps/api/src/registryLoader.ts"
)

PATTERN="from ['\"][^'\"]*(packages/engine-internal/|packages/core/(src|dist)/|src/core/|src/verifiers/|src/services/polygonMumbaiAnchor\\.js|/engine/(anchoring|compliance|registry)/|/services/(compliance|registryAdapters)\\.js|/anchor\\.js)[^'\"]*['\"]"

BASELINE_FILE="${API_BOUNDARY_BASELINE_FILE:-$REPO_ROOT/scripts/api-boundary-baseline.txt}"

violations="$(rg -n --glob '*.ts' "$PATTERN" "${TARGETS[@]}" | sort || true)"

if [[ -z "$violations" ]]; then
  echo "Public API boundary check passed."
  exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "Public gateway boundary violations detected (no baseline file at $BASELINE_FILE):"
  echo "$violations"
  exit 1
fi

baseline="$(rg -v '^(#|\\s*$)' "$BASELINE_FILE" | sort || true)"
new_violations="$(comm -13 <(printf '%s\n' "$baseline") <(printf '%s\n' "$violations") || true)"

if [[ -n "$new_violations" ]]; then
  echo "Public gateway boundary violations detected (not in baseline):"
  echo "$new_violations"
  exit 1
fi

echo "Public API boundary check passed (baseline-only violations present)."
