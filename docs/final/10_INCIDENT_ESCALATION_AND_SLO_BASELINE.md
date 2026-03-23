# Incident Escalation and SLO Baseline

## Purpose
Define the minimum incident response workflow and alert/SLO thresholds for pilot-safe operations.

## Scope
Applies to TrustSignal API operations in staging and production-like environments.

## Severity Model
- `SEV-1` Critical security or integrity event.
- `SEV-2` High customer-impacting degradation.
- `SEV-3` Medium localized issue or degraded non-critical dependency.

Trigger examples:
- `SEV-1`: key compromise, unauthorized cross-tenant access, verified data integrity regression.
- `SEV-2`: sustained 5xx spike, verification path outage, revocation path broken.
- `SEV-3`: elevated latency, partial dependency outage with graceful degradation.

## Escalation Workflow
1. Detect and triage incident (on-call engineer).
2. Assign incident commander and open timeline log.
3. Contain blast radius (rollback, feature flag, traffic controls).
4. Communicate status updates to stakeholders.
5. Recover service and verify core path health.
6. Publish post-incident review with corrective actions.

Target response times:
- `SEV-1`: acknowledge in 15 minutes, stakeholder update every 30 minutes.
- `SEV-2`: acknowledge in 30 minutes, stakeholder update every 60 minutes.
- `SEV-3`: acknowledge in 4 hours, update daily until resolved.

## Operational SLO Baseline
- API availability (health endpoint): `>= 99.5%` monthly.
- Verification request success ratio (`2xx/4xx expected`, excluding auth failures): `>= 98.0%` monthly.
- P95 API latency for core endpoints (`/api/v1/verify`, `/api/v1/receipt/:id`, `/api/v1/receipt/:id/verify`): `< 1.0s` monthly target.

## Initial Alert Thresholds
Use `/api/v1/metrics` Prometheus data:

1. Availability alert:
- Trigger: health probe failures for 3 consecutive checks.
- Severity: `SEV-2` (escalate to `SEV-1` if >15 minutes sustained).

2. Error rate alert:
- Signal: `5xx / total requests` using `deedshield_http_requests_total`.
- Warning: `> 2%` for 10 minutes.
- Critical: `> 5%` for 5 minutes.

3. Latency alert:
- Signal: p95 from `deedshield_http_request_duration_seconds`.
- Warning: `> 1.0s` for 10 minutes.
- Critical: `> 2.5s` for 5 minutes.

4. Traffic drop alert:
- Signal: request rate from `deedshield_http_requests_total`.
- Warning: request volume drops >70% from 24h baseline for 15 minutes (business hours).

## Required Artifacts for Gate Evidence
- dashboard links and alert rule definitions
- sample fired alert and resolution timeline
- status update log and post-incident template
- runbook links and owner list

## Open Items
- wire alert rules in staging monitoring stack
- validate baseline thresholds against one week of staging traffic
- tune thresholds per endpoint and tenant mix
