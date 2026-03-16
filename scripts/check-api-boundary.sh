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

if violations="$(rg -n --glob '*.ts' "$PATTERN" "${TARGETS[@]}")"; then
  if [[ -n "$violations" ]]; then
    echo "Public gateway boundary violations detected:"
    echo "$violations"
    exit 1
  fi
fi

echo "Public API boundary check passed."
