#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FILES=(
  "$ROOT/README.md"
  "$ROOT/USER_MANUAL.md"
  "$ROOT/apps/web/src/app"
)

BASELINE_FILE="${PUBLIC_MESSAGING_BASELINE_FILE:-$ROOT/scripts/public-messaging-baseline.txt}"

PATTERNS=(
  "production-ready"
  "zero-knowledge verification"
  "AI fraud scoring"
  "universal verification engine"
  "cryptographic fraud prevention platform"
)

echo "Checking public-facing TrustSignal messaging for risky terms..."

matches="$(
  for pattern in "${PATTERNS[@]}"; do
    rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' "$pattern" "${FILES[@]}" \
      | sed "s/^/[pattern:$pattern] /" || true
  done

  rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' \
    "DeedShield is an automated document verification platform|Cryptographic Fraud Prevention Platform|AI-first|blockchain-first" \
    "${FILES[@]}" | sed 's/^/[positioning] /' || true

  rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' \
    "HIPAA|SOC 2|GDPR" "$ROOT/apps/web/src/app" "$ROOT/USER_MANUAL.md" | sed 's/^/[compliance] /' || true
)"

matches="$(printf '%s\n' "$matches" | sed "s|$ROOT/||g" | rg -v '^\\s*$' | sort || true)"

if [[ -z "$matches" ]]; then
  echo "Messaging guardrail check passed."
  exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  echo
  echo "Found flagged messaging (no baseline file at $BASELINE_FILE):"
  echo "$matches"
  exit 1
fi

baseline="$(rg -v '^(#|\\s*$)' "$BASELINE_FILE" | sort || true)"
new_matches="$(comm -13 <(printf '%s\n' "$baseline") <(printf '%s\n' "$matches") || true)"

if [[ -n "$new_matches" ]]; then
  echo
  echo "Found flagged messaging (not in baseline):"
  echo "$new_matches"
  exit 1
fi

echo "Messaging guardrail check passed (baseline-only matches present)."
