#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FILES=(
  "$ROOT/README.md"
  "$ROOT/USER_MANUAL.md"
  "$ROOT/apps/web/src/app"
)

PATTERNS=(
  "production-ready"
  "zero-knowledge verification"
  "AI fraud scoring"
  "universal verification engine"
  "cryptographic fraud prevention platform"
)

echo "Checking public-facing TrustSignal messaging for risky terms..."

for pattern in "${PATTERNS[@]}"; do
  if rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' "$pattern" "${FILES[@]}"; then
    echo
    echo "Found flagged term: $pattern"
    exit 1
  fi
done

if rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' "DeedShield is an automated document verification platform|Cryptographic Fraud Prevention Platform|AI-first|blockchain-first" "${FILES[@]}"; then
  echo
  echo "Found flagged positioning language"
  exit 1
fi

if rg -n -i --glob '!**/*.tsbuildinfo' --glob '!**/node_modules/**' "HIPAA|SOC 2|GDPR" "$ROOT/apps/web/src/app" "$ROOT/USER_MANUAL.md"; then
  echo
  echo "Found unsupported compliance language in public-facing source"
  exit 1
fi

echo "Messaging guardrail check passed."
