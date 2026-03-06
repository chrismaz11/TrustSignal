#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <base-url> <api-key-with-verify-and-read-scope> [output-markdown-path]" >&2
  echo "Example: $0 https://staging-api.example.com \"$API_KEY\" docs/evidence/staging/vanta-integration-$(date -u +%Y%m%dT%H%M%SZ).md" >&2
  exit 1
fi

BASE_URL="${1%/}"
API_KEY="$2"
OUTFILE="${3:-docs/evidence/staging/vanta-integration-$(date -u +%Y%m%dT%H%M%SZ).md}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$(dirname "$OUTFILE")"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

get_with_status() {
  local url="$1"
  local outfile="$2"
  curl -sS -o "$outfile" -w '%{http_code}' -H "x-api-key: ${API_KEY}" "$url" || true
}

post_json_with_status() {
  local url="$1"
  local payload_file="$2"
  local outfile="$3"
  curl -sS -o "$outfile" -w '%{http_code}' \
    -H "x-api-key: ${API_KEY}" \
    -H 'content-type: application/json' \
    --data "@${payload_file}" \
    "$url" || true
}

excerpt() {
  local file="$1"
  if [[ -f "$file" ]]; then
    head -c 1400 "$file" || true
  else
    echo "(no response body captured)"
  fi
  echo
}

SYNTH_BODY="$TMPDIR/synthetic.json"
VERIFY_BODY="$TMPDIR/verify.json"
SCHEMA_BODY="$TMPDIR/schema.json"
VANTA_BODY="$TMPDIR/vanta.json"
: > "$VERIFY_BODY"
: > "$VANTA_BODY"

SYNTH_CODE="$(get_with_status "${BASE_URL}/api/v1/synthetic" "$SYNTH_BODY")"
VERIFY_CODE="not-run"
SCHEMA_CODE="$(get_with_status "${BASE_URL}/api/v1/integrations/vanta/schema" "$SCHEMA_BODY")"
VANTA_CODE="not-run"
RECEIPT_ID=""
VALIDATION_RESULT="failed"
VALIDATION_MESSAGE="not executed"

if [[ "$SYNTH_CODE" == "200" ]]; then
  VERIFY_CODE="$(post_json_with_status "${BASE_URL}/api/v1/verify" "$SYNTH_BODY" "$VERIFY_BODY")"
fi

if [[ "$VERIFY_CODE" == "200" ]]; then
  RECEIPT_ID="$(jq -r '.receiptId // empty' "$VERIFY_BODY")"
fi

if [[ -n "$RECEIPT_ID" ]]; then
  VANTA_CODE="$(get_with_status "${BASE_URL}/api/v1/integrations/vanta/verification/${RECEIPT_ID}" "$VANTA_BODY")"
fi

if [[ "$SCHEMA_CODE" == "200" && "$VANTA_CODE" == "200" ]]; then
  if jq -e '
    .schemaVersion == "trustsignal.vanta.verification_result.v1" and
    (.vendor.name == "TrustSignal") and
    (.subject.receiptId | type == "string") and
    (.result.decision | IN("ALLOW","FLAG","BLOCK")) and
    (.result.normalizedStatus | IN("PASS","REVIEW","FAIL"))
  ' "$VANTA_BODY" >/dev/null 2>&1; then
    VALIDATION_RESULT="passed"
    VALIDATION_MESSAGE="Payload matches required Vanta integration shape checks."
  else
    VALIDATION_RESULT="failed"
    VALIDATION_MESSAGE="Payload returned but required Vanta shape checks failed."
  fi
else
  VALIDATION_RESULT="failed"
  VALIDATION_MESSAGE="Could not validate because one or more prerequisite endpoint calls failed."
fi

{
  echo "# Vanta Integration Evidence Capture"
  echo
  echo "- Captured at (UTC): ${TS}"
  echo "- Base URL: ${BASE_URL}"
  echo "- Schema version target: trustsignal.vanta.verification_result.v1"
  echo
  echo "## Call Results"
  echo "- GET /api/v1/synthetic: ${SYNTH_CODE}"
  echo "- POST /api/v1/verify: ${VERIFY_CODE}"
  echo "- GET /api/v1/integrations/vanta/schema: ${SCHEMA_CODE}"
  echo "- GET /api/v1/integrations/vanta/verification/:receiptId: ${VANTA_CODE}"
  echo "- receiptId observed: ${RECEIPT_ID:-none}"
  echo
  echo "## Validation"
  echo "- Result: ${VALIDATION_RESULT}"
  echo "- Details: ${VALIDATION_MESSAGE}"
  echo
  echo "## Response Excerpts"
  echo "### GET /api/v1/synthetic"
  echo '```'
  excerpt "$SYNTH_BODY"
  echo '```'
  echo "### POST /api/v1/verify"
  echo '```'
  excerpt "$VERIFY_BODY"
  echo '```'
  echo "### GET /api/v1/integrations/vanta/schema"
  echo '```'
  excerpt "$SCHEMA_BODY"
  echo '```'
  echo "### GET /api/v1/integrations/vanta/verification/:receiptId"
  echo '```'
  excerpt "$VANTA_BODY"
  echo '```'
  echo
  echo "## Manual Attachments Required"
  echo "- Screenshot of Vanta workflow ingesting the payload"
  echo "- Timestamped run command and operator identity"
  echo "- Environment marker (staging or production)"
} > "$OUTFILE"

echo "Wrote evidence artifact: $OUTFILE"
