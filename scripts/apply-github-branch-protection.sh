#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <owner/repo> <branch>" >&2
  echo "Example: $0 TrustSignal-dev/TrustSignal master" >&2
  exit 1
fi

REPO="$1"
BRANCH="$2"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi

echo "Applying branch protection on $REPO:$BRANCH"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
PAYLOAD="$TMPDIR/branch-protection.json"

cat >"$PAYLOAD" <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "test", "rust-build"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_conversation_resolution": true
}
JSON

gh api --method PUT "repos/$REPO/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" \
  --input "$PAYLOAD"

echo "Enabling required signatures on $REPO:$BRANCH"
gh api --method POST "repos/$REPO/branches/$BRANCH/protection/required_signatures" >/dev/null

echo "Branch protection applied."
echo "Run scripts/capture-github-governance-evidence.sh to record post-change evidence."
