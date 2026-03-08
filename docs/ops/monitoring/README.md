# TrustSignal Monitoring Baseline (Staging)

This directory contains the minimum monitoring artifacts for DeedShield API pilot operations, aligned to:
- `docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`

## Files
- `alert-rules.yml`: Prometheus recording + alert rules for availability, 5xx ratio, latency, and traffic drop.
- `grafana-dashboard-deedshield-api.json`: baseline Grafana dashboard config for SLO and incident triage.

## Apply in Staging

1. Validate metrics are reachable from staging:
```bash
curl -fsSL "https://<staging-host>/api/v1/metrics" | head -n 30
```

2. Validate alert rule syntax before rollout:
```bash
promtool check rules docs/ops/monitoring/alert-rules.yml
```

3. Load rules in Prometheus (example `prometheus.yml` fragment):
```yaml
rule_files:
  - /etc/prometheus/rules/alert-rules.yml
```
Copy this repository file to the configured rules path and reload Prometheus.

4. Import dashboard in Grafana:
- Dashboards -> New -> Import
- Upload `docs/ops/monitoring/grafana-dashboard-deedshield-api.json`
- Select the staging Prometheus datasource
- Set `job` variable to the DeedShield API scrape job (or keep `All`)

5. Confirm baseline panels populate:
- Health Success Ratio (5m)
- 5xx Error Ratio
- Core Endpoint P95 (overall + per-route)
- Traffic Ratio to 24h Baseline

## Alert Threshold Mapping
- Availability:
  - `SEV-2` if health probe fails 3 consecutive checks
  - `SEV-1` if sustained for 15 minutes
- Error rate:
  - warning `> 2%` for 10m
  - critical `> 5%` for 5m
- Latency (core routes):
  - warning p95 `> 1.0s` for 10m
  - critical p95 `> 2.5s` for 5m
- Traffic drop:
  - warning when request volume is `< 30%` of 24h baseline for 15m during business hours (UTC 14:00-23:00 weekdays)

## Evidence Screenshots to Capture
Store screenshots in staging evidence (for example under `docs/evidence/staging/`) and include timestamps.

1. Prometheus rules loaded:
- `/rules` view showing `deedshield-api-slo-alerts` group and active thresholds.

2. Grafana dashboard baseline:
- Full dashboard with time range and all key panels visible.

3. Alert fire evidence:
- Alertmanager or Grafana Alerting view showing one fired alert (name, severity, start time).

4. Alert resolution evidence:
- Same alert transitioned to resolved with resolve timestamp.

5. Incident timeline/status evidence:
- Screenshot or export of status update log showing acknowledge/update cadence aligned to `SEV-1/2/3` policy.

6. Post-incident linkage evidence:
- Screenshot showing link/reference to post-incident review entry and corrective actions.

## Notes
- The alert rules use metrics emitted by `apps/api/src/server.ts`:
  - `deedshield_http_requests_total`
  - `deedshield_http_request_duration_seconds`
- Core latency scope follows baseline routes:
  - `/api/v1/verify`
  - `/api/v1/receipt/:receiptId`
  - `/api/v1/receipt/:receiptId/verify`
