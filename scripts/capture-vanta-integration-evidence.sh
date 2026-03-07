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
EVIDENCE_ENV="${EVIDENCE_ENV:-staging}"
EVIDENCE_OPERATOR="${EVIDENCE_OPERATOR:-unknown}"

mkdir -p "$(dirname "$OUTFILE")"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

get_with_status() {
  local url="$1"
  local outfile="$2"
  local headers="$3"
  curl -sS -o "$outfile" -D "$headers" -w '%{http_code}' -H "x-api-key: ${API_KEY}" "$url" || true
}

post_json_with_status() {
  local url="$1"
  local payload_file="$2"
  local outfile="$3"
  local headers="$4"
  curl -sS -o "$outfile" -w '%{http_code}' \
    -D "$headers" \
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

selected_headers() {
  local file="$1"
  grep -Ei '^(HTTP/|date:|server:|x-request-id:|x-vercel-id:|traceparent:|x-amzn-trace-id:)' "$file" || true
}

correlation_summary() {
  local file="$1"
  local request_id traceparent vercel_id amzn_trace
  request_id="$(awk -F': *' 'tolower($1)=="x-request-id" {gsub("\r","",$2); print $2; exit}' "$file")"
  traceparent="$(awk -F': *' 'tolower($1)=="traceparent" {gsub("\r","",$2); print $2; exit}' "$file")"
  vercel_id="$(awk -F': *' 'tolower($1)=="x-vercel-id" {gsub("\r","",$2); print $2; exit}' "$file")"
  amzn_trace="$(awk -F': *' 'tolower($1)=="x-amzn-trace-id" {gsub("\r","",$2); print $2; exit}' "$file")"
  if [[ -n "$request_id" || -n "$traceparent" || -n "$vercel_id" || -n "$amzn_trace" ]]; then
    printf 'x-request-id=%s; traceparent=%s; x-vercel-id=%s; x-amzn-trace-id=%s\n' \
      "${request_id:-none}" "${traceparent:-none}" "${vercel_id:-none}" "${amzn_trace:-none}"
  else
    echo "none observed in response headers"
  fi
}

SYNTH_BODY="$TMPDIR/synthetic.json"
VERIFY_BODY="$TMPDIR/verify.json"
SCHEMA_BODY="$TMPDIR/schema.json"
VANTA_BODY="$TMPDIR/vanta.json"
SYNTH_HEADERS="$TMPDIR/synthetic.headers"
VERIFY_HEADERS="$TMPDIR/verify.headers"
SCHEMA_HEADERS="$TMPDIR/schema.headers"
VANTA_HEADERS="$TMPDIR/vanta.headers"
: > "$VERIFY_BODY"
: > "$VANTA_BODY"
: > "$SYNTH_HEADERS"
: > "$VERIFY_HEADERS"
: > "$SCHEMA_HEADERS"
: > "$VANTA_HEADERS"

SYNTH_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SYNTH_CODE="$(get_with_status "${BASE_URL}/api/v1/synthetic" "$SYNTH_BODY" "$SYNTH_HEADERS")"
VERIFY_CODE="not-run"
VERIFY_TS="not-run"
SCHEMA_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SCHEMA_CODE="$(get_with_status "${BASE_URL}/api/v1/integrations/vanta/schema" "$SCHEMA_BODY" "$SCHEMA_HEADERS")"
VANTA_CODE="not-run"
VANTA_TS="not-run"
RECEIPT_ID=""
VALIDATION_RESULT="failed"
VALIDATION_MESSAGE="not executed"

if [[ "$SYNTH_CODE" == "200" ]]; then
  VERIFY_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  VERIFY_CODE="$(post_json_with_status "${BASE_URL}/api/v1/verify" "$SYNTH_BODY" "$VERIFY_BODY" "$VERIFY_HEADERS")"
fi

if [[ "$VERIFY_CODE" == "200" ]]; then
  RECEIPT_ID="$(jq -r '.receiptId // empty' "$VERIFY_BODY")"
fi

if [[ -n "$RECEIPT_ID" ]]; then
  VANTA_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  VANTA_CODE="$(get_with_status "${BASE_URL}/api/v1/integrations/vanta/verification/${RECEIPT_ID}" "$VANTA_BODY" "$VANTA_HEADERS")"
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
  echo "- Environment marker: ${EVIDENCE_ENV}"
  echo "- Operator: ${EVIDENCE_OPERATOR}"
  echo "- Base URL: ${BASE_URL}"
  echo "- Schema version target: trustsignal.vanta.verification_result.v1"
  echo
  echo "## Call Results"
  echo "| Endpoint | Timestamp (UTC) | HTTP status |"
  echo "| --- | --- | --- |"
  echo "| GET /api/v1/synthetic | ${SYNTH_TS} | ${SYNTH_CODE} |"
  echo "| POST /api/v1/verify | ${VERIFY_TS} | ${VERIFY_CODE} |"
  echo "| GET /api/v1/integrations/vanta/schema | ${SCHEMA_TS} | ${SCHEMA_CODE} |"
  echo "| GET /api/v1/integrations/vanta/verification/:receiptId | ${VANTA_TS} | ${VANTA_CODE} |"
  echo "- receiptId observed: ${RECEIPT_ID:-none}"
  echo
  echo "## Validation"
  echo "- Result: ${VALIDATION_RESULT}"
  echo "- Details: ${VALIDATION_MESSAGE}"
  echo
  echo "## Endpoint Header Evidence (for log correlation)"
  echo "### GET /api/v1/synthetic"
  echo '```text'
  selected_headers "$SYNTH_HEADERS"
  echo '```'
  echo "### POST /api/v1/verify"
  echo '```text'
  selected_headers "$VERIFY_HEADERS"
  echo '```'
  echo "### GET /api/v1/integrations/vanta/schema"
  echo '```text'
  selected_headers "$SCHEMA_HEADERS"
  echo '```'
  echo "### GET /api/v1/integrations/vanta/verification/:receiptId"
  echo '```text'
  selected_headers "$VANTA_HEADERS"
  echo '```'
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
  echo "## Deployed Vanta Endpoint Evidence Logs"
  echo "### Runtime log metadata placeholders (manual completion required)"
  echo "| Field | Value |"
  echo "| --- | --- |"
  echo '| Deployment ID / commit SHA | `<fill-deployment-id>` |'
  echo '| Runtime provider log URL | `<fill-log-url>` |'
  echo '| Vanta workspace or connector ID | `<fill-vanta-connector>` |'
  echo '| Evidence time window start (UTC) | `<fill-window-start>` |'
  echo '| Evidence time window end (UTC) | `<fill-window-end>` |'
  echo "| Operator identity confirmation | ${EVIDENCE_OPERATOR} |"
  echo
  echo "### Request correlation hints from this run"
  echo "| Endpoint | Correlation hints |"
  echo "| --- | --- |"
  echo "| GET /api/v1/synthetic | $(correlation_summary "$SYNTH_HEADERS") |"
  echo "| POST /api/v1/verify | $(correlation_summary "$VERIFY_HEADERS") |"
  echo "| GET /api/v1/integrations/vanta/schema | $(correlation_summary "$SCHEMA_HEADERS") |"
  echo "| GET /api/v1/integrations/vanta/verification/:receiptId | $(correlation_summary "$VANTA_HEADERS") |"
  echo
  echo "### Paste deployed endpoint log excerpts"
  echo '```text'
  echo "[UTC <timestamp>] GET /api/v1/synthetic status=<status> request_id=<id> env=${EVIDENCE_ENV}"
  echo "[UTC <timestamp>] POST /api/v1/verify status=<status> receiptId=<receipt_id> request_id=<id> env=${EVIDENCE_ENV}"
  echo "[UTC <timestamp>] GET /api/v1/integrations/vanta/schema status=<status> request_id=<id> env=${EVIDENCE_ENV}"
  echo "[UTC <timestamp>] GET /api/v1/integrations/vanta/verification/${RECEIPT_ID:-<receipt_id>} status=<status> request_id=<id> env=${EVIDENCE_ENV}"
  echo "[UTC <timestamp>] Vanta ingestion event connector=<connector_id> receiptId=${RECEIPT_ID:-<receipt_id>} result=<accepted|rejected>"
  echo '```'
  echo
  echo "## Manual Attachments Required"
  echo "- Screenshot of Vanta workflow ingesting the payload"
  echo "- Deployed API runtime log export for the four endpoint calls above"
  echo "- Vanta-side ingestion or connector logs matching receiptId and timestamps"
  echo "- Timestamped run command, operator identity, and environment marker"
} > "$OUTFILE"

echo "Wrote evidence artifact: $OUTFILE"
