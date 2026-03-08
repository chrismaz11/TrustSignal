#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <staging-base-url> [output-markdown-path]" >&2
  echo "Example: $0 https://staging-api.example.com docs/evidence/staging/staging-$(date -u +%Y%m%dT%H%M%SZ).md" >&2
  exit 1
fi

BASE_URL="${1%/}"
OUTFILE="${2:-docs/evidence/staging/staging-$(date -u +%Y%m%dT%H%M%SZ).md}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EVIDENCE_ENV="${EVIDENCE_ENV:-staging}"
EVIDENCE_OPERATOR="${EVIDENCE_OPERATOR:-unknown}"
AUTHORITY="$(echo "$BASE_URL" | sed -E 's#^https?://([^/]+).*$#\1#')"
HOST="${AUTHORITY%%:*}"
TLS_PORT="${AUTHORITY#*:}"

if [[ "$TLS_PORT" == "$AUTHORITY" ]]; then
  TLS_PORT="443"
fi

mkdir -p "$(dirname "$OUTFILE")"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

selected_headers() {
  local headers_file="$1"
  grep -Ei '^(HTTP/|date:|server:|strict-transport-security:|location:|x-request-id:|x-vercel-id:|traceparent:|x-forwarded-proto:)' "$headers_file" || true
}

http_probe() {
  local path="$1"
  local url="$BASE_URL$path"
  local body headers probe_ts
  local code

  body="$(mktemp "$TMPDIR/http-body.XXXXXX")"
  headers="$(mktemp "$TMPDIR/http-headers.XXXXXX")"
  probe_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  code="$(curl -sS -o "$body" -D "$headers" -w '%{http_code}' "$url" || true)"

  echo "### GET $path"
  echo "- Probe timestamp (UTC): $probe_ts"
  echo "- URL: $url"
  echo "- HTTP status: $code"
  echo "- Response headers (selected):"
  echo '```text'
  selected_headers "$headers"
  echo '```'
  echo "- Response excerpt:"
  echo '```'
  head -c 1200 "$body" || true
  echo
  echo '```'
}

tls_probe() {
  local probe_ts
  probe_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "### TLS probe"
  echo "- Probe timestamp (UTC): $probe_ts"
  echo "- Host: $HOST"
  echo "- TLS port: $TLS_PORT"
  echo "- Certificate details:"
  echo '```text'
  (echo | openssl s_client -connect "${HOST}:${TLS_PORT}" -servername "$HOST" 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>/dev/null) || true
  echo '```'
  echo "- Negotiated protocol/cipher details:"
  echo '```text'
  (echo | openssl s_client -connect "${HOST}:${TLS_PORT}" -servername "$HOST" 2>/dev/null | grep -E 'Protocol|Cipher|Verify return code') || true
  echo '```'
}

ingress_forwarding_probe() {
  local path="$1"
  local url="$BASE_URL$path"
  local probe_ts
  probe_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local default_body default_headers forced_http_body forced_http_headers forced_https_body forced_https_headers
  local default_code forced_http_code forced_https_code
  default_body="$(mktemp "$TMPDIR/forward-default-body.XXXXXX")"
  default_headers="$(mktemp "$TMPDIR/forward-default-headers.XXXXXX")"
  forced_http_body="$(mktemp "$TMPDIR/forward-http-body.XXXXXX")"
  forced_http_headers="$(mktemp "$TMPDIR/forward-http-headers.XXXXXX")"
  forced_https_body="$(mktemp "$TMPDIR/forward-https-body.XXXXXX")"
  forced_https_headers="$(mktemp "$TMPDIR/forward-https-headers.XXXXXX")"

  default_code="$(curl -sS -o "$default_body" -D "$default_headers" -w '%{http_code}' "$url" || true)"
  forced_http_code="$(curl -sS -o "$forced_http_body" -D "$forced_http_headers" -w '%{http_code}' -H 'x-forwarded-proto: http' "$url" || true)"
  forced_https_code="$(curl -sS -o "$forced_https_body" -D "$forced_https_headers" -w '%{http_code}' -H 'x-forwarded-proto: https' "$url" || true)"

  echo "### x-forwarded-proto forwarding behavior ($path)"
  echo "- Probe timestamp (UTC): $probe_ts"
  echo "| Variant | Request header override | HTTP status |"
  echo "| --- | --- | --- |"
  echo "| default | none | $default_code |"
  echo "| forced-http | x-forwarded-proto: http | $forced_http_code |"
  echo "| forced-https | x-forwarded-proto: https | $forced_https_code |"
  echo
  echo "#### Headers (default)"
  echo '```text'
  selected_headers "$default_headers"
  echo '```'
  echo "#### Headers (forced-http)"
  echo '```text'
  selected_headers "$forced_http_headers"
  echo '```'
  echo "#### Headers (forced-https)"
  echo '```text'
  selected_headers "$forced_https_headers"
  echo '```'
}

http_to_https_probe() {
  local path="$1"
  local http_url="http://${AUTHORITY}${path}"
  local probe_ts
  probe_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local body headers code
  body="$(mktemp "$TMPDIR/http-to-https-body.XXXXXX")"
  headers="$(mktemp "$TMPDIR/http-to-https-headers.XXXXXX")"
  code="$(curl -sS -o "$body" -D "$headers" -w '%{http_code}' "$http_url" || true)"

  echo "### HTTP->HTTPS ingress behavior ($path)"
  echo "- Probe timestamp (UTC): $probe_ts"
  echo "- Probe URL: $http_url"
  echo "- HTTP status: $code"
  echo "- Headers (selected):"
  echo '```text'
  selected_headers "$headers"
  echo '```'
}

tls_policy_placeholders() {
  echo "### TLS policy metadata placeholders (manual completion required)"
  echo "| Field | Value |"
  echo "| --- | --- |"
  echo '| Edge or load balancer provider | `<fill-provider-name>` |'
  echo '| Ingress resource ID | `<fill-ingress-id>` |'
  echo '| TLS policy/profile ID | `<fill-policy-id>` |'
  echo '| Minimum TLS protocol enforced | `<fill-min-version>` |'
  echo '| Allowed cipher suites policy | `<fill-cipher-policy>` |'
  echo '| Certificate identifier (ARN/ID) | `<fill-cert-id>` |'
  echo '| Certificate renewal mechanism | `<fill-renewal-policy>` |'
  echo '| Policy screenshot or API evidence link | `<fill-link>` |'
}

{
  echo "# Staging Evidence Capture"
  echo
  echo "- Captured at (UTC): $TS"
  echo "- Environment marker: $EVIDENCE_ENV"
  echo "- Operator: $EVIDENCE_OPERATOR"
  echo "- Base URL: $BASE_URL"
  echo
  echo "## API Health and Observability"
  http_probe "/api/v1/health"
  http_probe "/api/v1/status"
  http_probe "/api/v1/metrics"
  echo
  echo "## HTTPS Ingress Forwarding Evidence"
  http_to_https_probe "/api/v1/health"
  ingress_forwarding_probe "/api/v1/health"
  echo
  echo "## Transport Security"
  tls_probe
  echo
  echo "## TLS Policy Metadata"
  tls_policy_placeholders
  echo
  echo "## Manual Attachments Required"
  echo "- DB encrypted-at-rest evidence (provider screenshot/API output)"
  echo "- DB TLS enforcement evidence (connection policy/parameter group/config)"
  echo "- Ingress forwarding evidence confirmation (include load balancer/access logs for x-forwarded-proto)"
  echo "- TLS policy evidence (version/cipher policy at LB or edge, mapped to placeholders above)"
  echo "- Command transcript showing run time, operator identity, and staging deployment reference"
} > "$OUTFILE"

echo "Wrote evidence artifact: $OUTFILE"
