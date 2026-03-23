#!/bin/bash
# =============================================================
# TrustSignal — API Test Suite
# Tests: hash, ingest, policy check, verify, tamper detection
# Base URL: update API_URL to match your environment
# =============================================================

API_URL="https://api.trustsignal.dev"
API_KEY="d4a2bd92be56c54905a99f2b5709e14064e9eaeb99c44aa74898125aedf5028a"

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo -e "\n${BOLD}TrustSignal API Test Suite${RESET}"
echo "=================================================="

# ----------------------------------------------------------
# Spinner — runs in background while curl executes
# Usage: start_spinner "label" & SPIN_PID=$!
#        stop_spinner $SPIN_PID
# ----------------------------------------------------------
SPINNER_FRAMES=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

start_spinner() {
  local label="$1"
  local i=0
  while true; do
    printf "\r  ${SPINNER_FRAMES[$i]} $label..." 2>/dev/null
    i=$(( (i+1) % ${#SPINNER_FRAMES[@]} ))
    sleep 0.1
  done
}

stop_spinner() {
  local pid=$1
  kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  printf "\r\033[K"  # clear spinner line
}


# ----------------------------------------------------------
# TEST 1 — Service Contract (PSA)
# Expected: PASS — all metadata present, signature required
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 1] Service Contract — PSA-2026-001${RESET}"
echo "File: 1774182030454_test_contract.html"
echo "Expected: PASS"

start_spinner "Sending contract to /v1/ingest" &
SPIN_PID=$!
RESULT=$(curl -s -X POST "$API_URL/v1/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030454_test_contract.html;type=text/html" \
  -F "doc_id=PSA-2026-001" \
  -F "doc_type=service_agreement" \
  -F "policy_tags=requires_signature,requires_notarization=false,retention_years=7")
stop_spinner $SPIN_PID
echo "$RESULT" | jq '.'
echo -e "${GREEN}→ Check: status=PASS, receipt_id present, hash present${RESET}"


# ----------------------------------------------------------
# TEST 2 — Financial Schedule (ACFR)
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 2] Financial Schedule — ACFR-GF-R-01-2025${RESET}"
echo "File: 1774182030456_test_financial_schedule.html"
echo "Expected: PASS (if prior hash on file) or WARN (first submission)"

start_spinner "Sending financial schedule to /v1/ingest" &
SPIN_PID=$!
RESULT=$(curl -s -X POST "$API_URL/v1/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030456_test_financial_schedule.html;type=text/html" \
  -F "doc_id=ACFR-GF-R-01-2025" \
  -F "doc_type=financial_schedule" \
  -F "policy_tags=requires_prior_version_match=true,fiscal_year=2025,fund=general")
stop_spinner $SPIN_PID
echo "$RESULT" | jq '.'
echo -e "${GREEN}→ Check: prior_version_match field in response, hash anchored${RESET}"


# ----------------------------------------------------------
# TEST 3 — Government Registration Form
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 3] Government Form — GOV-FORM-2026-0042${RESET}"
echo "File: 1774182030456_test_gov_form.html"
echo "Expected: PASS"

start_spinner "Sending gov form to /v1/ingest" &
SPIN_PID=$!
RESULT=$(curl -s -X POST "$API_URL/v1/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030456_test_gov_form.html;type=text/html" \
  -F "doc_id=GOV-FORM-2026-0042" \
  -F "doc_type=government_form" \
  -F "policy_tags=requires_signature=true,requires_notarization=false,govt_entity=IL-IDFPR,public_record=true")
stop_spinner $SPIN_PID
echo "$RESULT" | jq '.'
echo -e "${GREEN}→ Check: signature_check=passed, public_record flag acknowledged${RESET}"


# ----------------------------------------------------------
# TEST 4a — Invoice (original, clean)
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 4a] Invoice ORIGINAL — INV-2026-0047${RESET}"
echo "File: 1774182030457_test_invoice.html"
echo "Expected: CONDITIONAL (PO match check)"

start_spinner "Sending clean invoice to /v1/ingest" &
SPIN_PID=$!
INGEST_RESPONSE=$(curl -s -X POST "$API_URL/v1/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030457_test_invoice.html;type=text/html" \
  -F "doc_id=INV-2026-0047" \
  -F "doc_type=invoice" \
  -F "policy_tags=requires_signature=false,payment_terms=net30,currency=USD,requires_po_match=true" \
  -F "po_number=PO-ACME-2026-0011")
stop_spinner $SPIN_PID
echo "$INGEST_RESPONSE" | jq '.'

RECEIPT_ID=$(echo "$INGEST_RESPONSE" | jq -r '.receipt_id // "TSR-2026-inv0047-original"')
ORIGINAL_HASH=$(echo "$INGEST_RESPONSE" | jq -r '.hash // "b7e2...f491"')

echo -e "${GREEN}→ Saved receipt_id: $RECEIPT_ID${RESET}"
echo -e "${GREEN}→ Saved original hash: $ORIGINAL_HASH${RESET}"
echo -e "${YELLOW}→ Check: po_match_required=true, conditional status if PO not on file${RESET}"


# ----------------------------------------------------------
# TEST 4b — Invoice TAMPERED (hash mismatch test)
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 4b] Invoice TAMPERED — Hash Mismatch Detection${RESET}"
echo "File: 1774182030456_test_invoice_tampered.html"
echo "Expected: FAIL — HASH_MISMATCH"

start_spinner "Verifying tampered invoice against receipt" &
SPIN_PID=$!
RESULT=$(curl -s -X POST "$API_URL/v1/verify" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030456_test_invoice_tampered.html;type=text/html" \
  -F "doc_id=INV-2026-0047" \
  -F "receipt_id=$RECEIPT_ID" \
  -F "original_hash=$ORIGINAL_HASH")
stop_spinner $SPIN_PID
echo "$RESULT" | jq '.'
echo -e "${RED}→ Check: status=FAIL, reason=HASH_MISMATCH, verdict=DOCUMENT_ALTERED_AFTER_RECEIPT${RESET}"
echo -e "${RED}→ 4 tampered fields: due_date, status, po_number, overage_qty${RESET}"


# ----------------------------------------------------------
# TEST 5 — CPA Credential / License
# ----------------------------------------------------------
echo -e "\n${BOLD}[TEST 5] CPA Credential — CRED-IL-CPA-2026-009182${RESET}"
echo "File: 1774182030455_test_credential.html"
echo "Expected: PASS"

start_spinner "Sending CPA credential to /v1/ingest" &
SPIN_PID=$!
RESULT=$(curl -s -X POST "$API_URL/v1/ingest" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/json" \
  -F "file=@1774182030455_test_credential.html;type=text/html" \
  -F "doc_id=CRED-IL-CPA-2026-009182" \
  -F "doc_type=professional_credential" \
  -F "policy_tags=requires_issuer_signature=true,issuer=IL-IDFPR,credential_type=CPA_LICENSE,expiry_check=true" \
  -F "credential_expiry=2026-12-31")
stop_spinner $SPIN_PID
echo "$RESULT" | jq '.'
echo -e "${GREEN}→ Check: expiry_check=passed, issuer_verified=true, status=ACTIVE${RESET}"


# ----------------------------------------------------------
# SUMMARY
# ----------------------------------------------------------
echo -e "\n=================================================="
echo -e "${BOLD}Test summary${RESET}"
echo -e "  Test 1 — Contract         → Expected: ${GREEN}PASS${RESET}"
echo -e "  Test 2 — Financial sched  → Expected: ${GREEN}PASS / WARN (first run)${RESET}"
echo -e "  Test 3 — Gov form         → Expected: ${GREEN}PASS${RESET}"
echo -e "  Test 4a — Invoice clean   → Expected: ${YELLOW}CONDITIONAL${RESET}"
echo -e "  Test 4b — Invoice tampered→ Expected: ${RED}FAIL — HASH_MISMATCH${RESET}"
echo -e "  Test 5 — CPA credential   → Expected: ${GREEN}PASS${RESET}"
echo -e "==================================================\n"
