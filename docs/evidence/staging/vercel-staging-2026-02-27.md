# Vercel Staging Evidence Capture

- Captured at (UTC): 2026-02-27T18:41:30Z
- Deployment URL: https://trust-signal-agmnni6ue-christopher-marzianis-projects.vercel.app

## API Health and Observability
### GET /api/v1/health
- Deployment: https://trust-signal-agmnni6ue-christopher-marzianis-projects.vercel.app
- HTTP status: 200
- Response excerpt:
```
HTTP/2 200 
age: 0
cache-control: public, max-age=0, must-revalidate
content-type: application/json; charset=utf-8
date: Fri, 27 Feb 2026 18:41:33 GMT
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
vary: Origin
x-ratelimit-limit: 600
x-ratelimit-remaining: 599
x-ratelimit-reset: 60
x-robots-tag: noindex
x-vercel-cache: MISS
x-vercel-id: cle1::iad1::4vxzx-1772217692451-e828744ce1f0
content-length: 15

{"status":"ok"}
```
### GET /api/v1/status
- Deployment: https://trust-signal-agmnni6ue-christopher-marzianis-projects.vercel.app
- HTTP status: 200
- Response excerpt:
```
HTTP/2 200 
age: 0
cache-control: public, max-age=0, must-revalidate
content-type: application/json; charset=utf-8
date: Fri, 27 Feb 2026 18:41:35 GMT
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
vary: Origin
x-ratelimit-limit: 600
x-ratelimit-remaining: 598
x-ratelimit-reset: 59
x-robots-tag: noindex
x-vercel-cache: MISS
x-vercel-id: cle1::iad1::xw5xk-1772217694988-d326dd7cf547
content-length: 128

{"status":"ok","service":"trust-signal-api","environment":"production","uptimeSeconds":15,"timestamp":"2026-02-27T18:41:35.104Z"}
```
### GET /api/v1/metrics
- Deployment: https://trust-signal-agmnni6ue-christopher-marzianis-projects.vercel.app
- HTTP status: 200
- Response excerpt:
```
HTTP/2 200 
age: 0
cache-control: public, max-age=0, must-revalidate
content-type: text/plain; version=0.0.4; charset=utf-8
date: Fri, 27 Feb 2026 18:41:36 GMT
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
vary: Origin
x-ratelimit-limit: 600
x-ratelimit-remaining: 597
x-ratelimit-reset: 57
x-robots-tag: noindex
x-vercel-cache: MISS
x-vercel-id: cle1::iad1::bz5bq-1772217696692-64d3627b4262
content-length: 13508

# HELP trustsignal_api_process_cpu_user_seconds_total Total user CPU time spent in seconds.
# TYPE trustsignal_api_process_cpu_user_seconds_total counter
trustsignal_api_process_cpu_user_seconds_total 0.132708

# HELP trustsignal_api_process_cpu_system_seconds_total Total system CPU time spent in seconds.
# TYPE trustsignal_api_process_cpu_system_seconds_total counter
trustsignal_api_process_cpu_system_seconds_total 0.041515

# HELP trustsignal_api_process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE trustsignal_api_process_cpu_seconds_total counter
trustsignal_api_process_cpu_seconds_total 0.174223

# HELP trustsignal_api_process_start_time_seconds Start time of the process since unix epoch in seconds.
# TYPE trustsignal_api_process_start_time_seconds gauge
trustsignal_api_process_start_time_seconds 1772217680

# HELP trustsignal_api_process_resident_memory_bytes Resident memory size in bytes.
# TY
```

## Transport Security
### TLS probe
- Host: trust-signal-agmnni6ue-christopher-marzianis-projects.vercel.app
- Output excerpt:
```
subject=CN=*.vercel.app
issuer=C=US, O=Google Trust Services, CN=WR1
notBefore=Feb 26 06:28:03 2026 GMT
notAfter=May 27 06:28:02 2026 GMT
```

## Manual Attachments Required
- DB encrypted-at-rest evidence (Supabase project settings)
- DB TLS enforcement evidence (connection settings)
- Ingress forwarding evidence (x-forwarded-proto=https)
- Alert rules and dashboard screenshots
