#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <owner/repo> <branch> [output-markdown-path]" >&2
  echo "Example: $0 TrustSignal-dev/TrustSignal master docs/evidence/security/github-governance-\$(date -u +%Y%m%dT%H%M%SZ).md" >&2
  exit 1
fi

REPO="$1"
BRANCH="$2"
OUTFILE="${3:-docs/evidence/security/github-governance-$(date -u +%Y%m%dT%H%M%SZ).md}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$(dirname "$OUTFILE")"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

run_or_capture() {
  local outfile="$1"
  shift
  if "$@" >"$outfile" 2>&1; then
    return 0
  fi
  return 1
}

AUTH_JSON="$TMPDIR/auth.json"
REPO_JSON="$TMPDIR/repo.json"
BRANCH_JSON="$TMPDIR/branch.json"
PROTECTION_JSON="$TMPDIR/protection.json"
SEC_ADV_JSON="$TMPDIR/security_and_analysis.json"

run_or_capture "$AUTH_JSON" gh auth status
run_or_capture "$REPO_JSON" gh api "repos/$REPO"
run_or_capture "$BRANCH_JSON" gh api "repos/$REPO/branches/$BRANCH"
run_or_capture "$PROTECTION_JSON" gh api "repos/$REPO/branches/$BRANCH/protection"
run_or_capture "$SEC_ADV_JSON" gh api "repos/$REPO" --jq '.security_and_analysis'

{
  echo "# GitHub Governance Evidence"
  echo
  echo "- Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- Repository: \`$REPO\`"
  echo "- Branch: \`$BRANCH\`"
  echo
  echo "## Auth Snapshot"
  echo
  echo '```text'
  cat "$AUTH_JSON"
  echo '```'
  echo
  echo "## Branch Protection Snapshot"
  echo
  if jq -e '.protected == true' "$BRANCH_JSON" >/dev/null 2>&1; then
    echo "- protected: true"
  else
    echo "- protected: false"
  fi
  echo "- required reviews: $(jq -r '.required_pull_request_reviews.required_approving_review_count // "n/a"' "$PROTECTION_JSON")"
  echo "- dismiss stale reviews: $(jq -r '.required_pull_request_reviews.dismiss_stale_reviews // "n/a"' "$PROTECTION_JSON")"
  echo "- require conversation resolution: $(jq -r '.required_conversation_resolution.enabled // "n/a"' "$PROTECTION_JSON")"
  echo "- require signed commits: $(jq -r '.required_signatures.enabled // "n/a"' "$PROTECTION_JSON")"
  echo "- enforce admins: $(jq -r '.enforce_admins.enabled // "n/a"' "$PROTECTION_JSON")"
  echo "- required status checks: $(jq -r '(.required_status_checks.checks // []) | map(.context) | if length > 0 then join(", ") else "n/a" end' "$PROTECTION_JSON")"
  echo
  echo "### Raw Branch JSON"
  echo
  echo '```json'
  jq . "$BRANCH_JSON"
  echo '```'
  echo
  echo "### Raw Protection JSON"
  echo
  echo '```json'
  jq . "$PROTECTION_JSON"
  echo '```'
  echo
  echo "## Repo Security and Analysis"
  echo
  echo '```json'
  jq . "$SEC_ADV_JSON"
  echo '```'
  echo
  echo "## Interpretation"
  echo
  echo "- Use this file as dated evidence for branch protection and security-analysis settings."
  echo "- If branch protection fields are \`n/a\`, verify branch name and permissions."
} >"$OUTFILE"

echo "Wrote evidence artifact: $OUTFILE"
