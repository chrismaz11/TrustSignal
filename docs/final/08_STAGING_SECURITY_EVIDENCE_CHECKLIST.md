# Staging Security Evidence Checklist

## Objective
Produce staging evidence for production gate items currently marked as "verified in test" only.

## Evidence Areas

### 1. Database Encryption and TLS
- confirm managed PostgreSQL encrypted-at-rest setting
- confirm application DB connection enforces TLS (`sslmode=require` or stronger)
- attach provider screenshots or API output with timestamps

### 2. HTTPS Ingress Enforcement
- confirm TLS certificate chain and renewal policy
- confirm TLS 1.3 policy at ingress/load balancer
- confirm `x-forwarded-proto=https` forwarding behavior
- capture API behavior when HTTPS forwarding is absent/present
- record request/response header evidence for default, forced-http, and forced-https forwarding probes

### 3. Monitoring and Status Surface
- confirm `/api/v1/health`, `/api/v1/status`, `/api/v1/metrics` reachable in staging
- confirm scrape target and dashboard ingestion for request/latency metrics
- define and enable first alert thresholds

### 4. Deployed Vanta Endpoint Evidence Logs
- capture deployed endpoint call timeline (timestamp + status) for:
  - `/api/v1/synthetic`
  - `/api/v1/verify`
  - `/api/v1/integrations/vanta/schema`
  - `/api/v1/integrations/vanta/verification/:receiptId`
- capture response header correlation hints (`x-request-id`, `traceparent`, platform IDs)
- attach runtime/provider logs and Vanta ingestion logs for the same evidence window

## Acceptance Artifacts
- command log snippets
- screenshots/console output from cloud console
- test run IDs and timestamps
- links to dashboard panels and alert definitions
- HTTPS ingress forwarding markdown section with per-probe timestamps
- TLS policy metadata placeholder table completed with provider policy values
- deployed endpoint log metadata (deployment ID/commit SHA, log URL, evidence window)
- correlation IDs tying endpoint calls to runtime logs and Vanta ingestion events
- Vanta integration evidence capture for:
  - `/api/v1/integrations/vanta/schema`
  - `/api/v1/integrations/vanta/verification/:receiptId`

## Automation Output Requirements
- `scripts/capture-staging-evidence.sh` output must include:
  - `## HTTPS Ingress Forwarding Evidence`
  - `## Transport Security`
  - `## TLS Policy Metadata`
- `scripts/capture-vanta-integration-evidence.sh` output must include:
  - `## Call Results` with endpoint timeline
  - `## Endpoint Header Evidence (for log correlation)`
  - `## Deployed Vanta Endpoint Evidence Logs`

## Current Artifacts (2026-02-27 UTC)
- `docs/evidence/staging/vercel-staging-2026-02-27.md` (API health/status/metrics + TLS certificate probe)
- `docs/evidence/staging/supabase-db-security-2026-02-27.md` (Supabase SSL enforcement, root-key presence redaction, TLSv1.3 session proof)
- `docs/ops/monitoring/alert-rules.yml` + `docs/ops/monitoring/grafana-dashboard-trustsignal-api.json` (staging monitoring rollout artifacts)
- `scripts/capture-staging-evidence.sh` (staging API + ingress forwarding + TLS metadata evidence automation)
- `scripts/capture-vercel-staging-evidence.sh` (Vercel deployment probe automation)
- `scripts/capture-supabase-db-security-evidence.sh` (Supabase DB control evidence automation)
- `scripts/capture-vanta-integration-evidence.sh` (Vanta endpoint, correlation headers, and deployed log evidence automation)

## Signoff
- engineering owner
- security owner
- operations owner
