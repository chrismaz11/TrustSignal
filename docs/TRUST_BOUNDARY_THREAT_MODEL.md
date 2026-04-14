# TrustSignal Trust Boundary Diagram & Threat Model

## Executive Summary

TrustSignal’s production security model should be defined around a narrow set of verifiable guarantees: artifact hashing, signed receipt issuance, independent receipt verification, scoped API access, and authenticated webhook handling. Chain anchoring and ZKP attestation should remain explicitly outside the core production trust boundary until their operational and cryptographic dependencies are stabilized.

This document provides a practical trust-boundary diagram, threat model, and control map for the current TrustSignal product suite. It is written to support engineering decisions, security review, partner diligence, and future SOC 2 / ISO 27001 control mapping.

---

## 1. System Context

### In-Scope Production Components

* **trustsignal core API**
  * verification endpoints
  * receipt issuance
  * receipt retrieval / redaction
  * API key scope enforcement
  * signing / verification logic
* **TrustSignal-App**
  * GitHub webhook ingress
  * GitHub App orchestration
  * replay protection
  * installation-token usage
* **TrustSignal/github-actions/trustsignal-verify-artifact**
  * CI/CD hashing client
  * API submission to TrustSignal
  * log hygiene / secret masking
* **v0-signal-new**
  * partner-gated demo surfaces
  * partner access session handling
* **CI/CD and deployment surfaces**
  * GitHub Actions
  * Vercel deployment
  * environment secret injection

### Explicitly Out of Current Production Trust Boundary

* blockchain / chain anchoring as a required verification dependency
* ZKP attestation as a required verification dependency
* research workflows in `trustagents`
* experimental or dev-only proof systems

---

## 2. Trust Boundary Diagram

```text
                                      ┌─────────────────────────────┐
                                      │        External Users       │
                                      │ developers / auditors /     │
                                      │ partner evaluators          │
                                      └──────────────┬──────────────┘
                                                     │
                                     Public Internet │ TLS 1.2+
                                                     │
                      ┌──────────────────────────────┼──────────────────────────────┐
                      │                              │                              │
                      ▼                              ▼                              ▼
        ┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
        │ TrustSignal Core API   │     │   TrustSignal-App      │     │    v0-signal-new       │
        │ Verification Service   │     │ GitHub App Orchestrator│     │ Partner / Demo Frontend│
        ├────────────────────────┤     ├────────────────────────┤     ├────────────────────────┤
        │ /api/v1/verify         │     │ /webhooks/github       │     │ /api/partner-access    │
        │ /api/v1/receipt/:id    │     │ internal GitHub flows  │     │ /partner/*             │
        │ /api/v1/status         │     │ replay protection      │     │ signed session cookie  │
        └────────────┬───────────┘     └────────────┬───────────┘     └────────────┬───────────┘
                     │                              │                              │
                     │ scoped API keys             │ webhook secret / JWT          │ HMAC session secret
                     │                              │ installation token            │
                     ▼                              ▼                              ▼
        ┌────────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┐
        │ Secrets / Runtime Env  │     │ GitHub API             │     │ Browser Cookie Boundary│
        │ signing keys           │     │ check runs / metadata  │     │ HttpOnly / Secure      │
        │ API_KEYS               │     │ installation context   │     │ SameSite / expiry      │
        │ JWT / JWK material     │     └────────────────────────┘     └────────────────────────┘
        └────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Data / Persistence     │
        │ receipts               │
        │ verification metadata  │
        │ redacted public view   │
        └────────────────────────┘


       CI/CD Boundary

       GitHub Actions Runner
                │
                │ artifact / digest / API key secret
                ▼
       ┌────────────────────────┐
       │ TrustSignal-Verify-    │
       │ Artifact Action        │
       ├────────────────────────┤
       │ hash artifact          │
       │ submit verify request  │
       │ receive signed receipt │
       │ mask secrets in logs   │
       └────────────┬───────────┘
                    │ x-api-key over TLS
                    ▼
             TrustSignal Core API
```

---

## 3. Core Assets to Protect

### Integrity-Critical Assets

* artifact digests and verification inputs
* signed receipts and receipt metadata
* signing keys and JWK material
* API keys and scoped service credentials
* GitHub webhook secret
* GitHub App private key
* installation tokens
* replay store data / delivery identifiers
* partner session signing secret

### Sensitive Operational Assets

* internal verification metadata
* private demo content and partner-only routes
* request logs and failure diagnostics
* revocation signatures and timestamp metadata
* deployment environment configuration

---

## 4. Security Objectives

1. **Authenticity**
   * only authorized callers can invoke protected operations
   * only authentic GitHub webhooks are processed

2. **Integrity**
   * artifacts, receipts, and signed data cannot be tampered with undetected
   * receipt verification remains deterministic and stable

3. **Confidentiality**
   * secrets, tokens, and non-public metadata are never exposed in logs or public APIs
   * partner-only routes remain gated

4. **Availability**
   * verification service remains usable under expected operational failures
   * optional systems do not block core receipt issuance and verification

5. **Non-Repudiation / Auditability**
   * signed receipt issuance is attributable and later verifiable
   * security-relevant operations are observable without leaking secrets

---

## 5. Primary Trust Boundaries

### Boundary A — Public Internet to TrustSignal Core API

**Threats:** unauthorized calls, input tampering, abusive traffic, schema abuse, metadata leakage

**Primary controls:**
* TLS 1.2+
* API-key authentication
* scope enforcement by operation
* strict request validation
* redacted public receipt view
* fail-closed handling for malformed auth / input

### Boundary B — GitHub to TrustSignal-App Webhook Ingress

**Threats:** forged webhooks, replay attacks, malformed payloads, event flooding

**Primary controls:**
* HMAC signature verification using `X-Hub-Signature-256`
* timing-safe comparison
* replay protection on `X-GitHub-Delivery`
* event schema validation
* idempotent downstream handling

### Boundary C — TrustSignal-App to GitHub API

**Threats:** token misuse, over-privileged app permissions, cross-repo action misuse

**Primary controls:**
* GitHub App JWT exchange for installation token
* least-privilege GitHub App permissions
* in-memory or short-lived token handling only
* no persistence of installation tokens
* installation / owner / repo context checks

### Boundary D — GitHub Actions Runner to TrustSignal Core API

**Threats:** secret leakage in logs, forged verification requests, misuse of CI credentials

**Primary controls:**
* encrypted secret injection by CI platform
* explicit secret masking
* sanitized error reporting
* no header dumping or auth-bearing object logging
* API-key scope restrictions

### Boundary E — Browser to Partner-Gated Demo Surface

**Threats:** cookie forgery, stale session reuse, route discovery, unauthorized demo access

**Primary controls:**
* HMAC-signed session payload
* embedded `iat` / `exp`
* HttpOnly + Secure + SameSite cookie attributes
* no public linking to partner-only routes
* fail-closed token parsing and verification

### Boundary F — Runtime to Secret Material

**Threats:** env leakage, accidental logging, unsafe local fallbacks, secret reuse across environments

**Primary controls:**
* environment-scoped secret management
* production fail-closed requirements
* no secret logging
* separate dev vs prod secret behavior
* documented runtime secret inventory

---

## 6. Data Flow Summary

### Verification Flow

1. client computes or submits artifact digest
2. request sent to TrustSignal Core API over TLS
3. API authenticates caller and validates scope
4. verification logic constructs canonical receipt payload
5. signing key issues signed receipt
6. receipt is returned to caller
7. later verification retrieves public or authorized receipt view

### GitHub Webhook Flow

1. GitHub sends webhook to TrustSignal-App
2. app verifies HMAC signature
3. app checks replay / idempotency state
4. app derives installation context and short-lived token
5. app calls GitHub API and/or TrustSignal Core API as needed
6. app publishes check result / receipt reference

### Partner Access Flow

1. partner submits access credential
2. server validates partner secret
3. server issues signed access cookie containing `iat` and `exp`
4. middleware verifies signature and expiry on each request
5. access allowed only for intended gated routes

---

## 7. Threat Model

## 7.1 Threat Actors

### External attacker
Motivated to forge receipts, abuse APIs, gain unauthorized demo access, or induce trust failures.

### Malicious or compromised CI environment
Can attempt to leak secrets, submit fraudulent verification requests, or alter artifact identity.

### Compromised GitHub repository or workflow
Can emit malicious artifacts, trigger unauthorized events, or abuse app installation context.

### Curious partner / evaluator
May enumerate routes, test partner-gated access paths, or inspect redaction boundaries.

### Insider / operator error
May misconfigure secrets, expose routes, overstate feature guarantees, or weaken fail-closed behavior.

---

## 7.2 STRIDE-Oriented Threat Analysis

### Spoofing
* forged GitHub webhook
* forged partner session cookie
* forged API client identity using leaked API key
* forged revocation signer metadata

**Controls:** HMAC verification, scoped API keys, signed session payloads, signature verification, key separation.

### Tampering
* modification of artifact digest in transit
* modification of receipt payload before signing or after storage
* manipulation of replay store or session payload
* docs / marketing drift that misrepresents guarantees

**Controls:** TLS, canonical signing payloads, signature verification, structured change review, regression tests.

### Repudiation
* operator denies issuing receipt
* caller disputes verification result
* webhook sender disputes event handling

**Controls:** signed receipts, delivery identifiers, audit-friendly logs, correlation IDs without sensitive payload leakage.

### Information Disclosure
* leaked API keys or installation tokens in logs
* private receipt metadata exposed through public route
* partner demo content indexed or linked publicly
* secret-bearing env values exposed in diagnostics

**Controls:** log hygiene, receipt redaction, route gating, secret masking, no raw secret logging.

### Denial of Service
* verify endpoint flooding
* webhook flooding / replay storms
* DB dependency causing receipt retrieval failure
* malformed request amplification

**Controls:** rate limiting where appropriate, schema validation, replay handling, bounded work per request, non-blocking optional subsystems.

### Elevation of Privilege
* read-scoped key calling verify-scoped route
* GitHub App token used outside intended installation context
* partner cookie reused for broader route access
* experimental features treated as production guarantees

**Controls:** scope enforcement tests, context-aware token use, route scoping, conservative product claims.

---

## 8. Highest-Priority Threat Scenarios

### Scenario 1 — Forged Webhook Trigger
**Description:** attacker sends a fabricated GitHub event to cause unauthorized receipt or check-run behavior.
**Impact:** false verification signaling, partner trust erosion, integrity confusion.
**Required controls:**
* verify HMAC before any business logic
* reject invalid signature
* do not check replay before signature validation
* log only minimal sanitized metadata

### Scenario 2 — API Key Scope Bypass
**Description:** a key intended for read access is used to call privileged verification or administrative operations.
**Impact:** unauthorized receipt issuance or control-path abuse.
**Required controls:**
* explicit scope enforcement middleware
* negative tests for all privileged routes
* fail-closed default when scope unknown

### Scenario 3 — Secret Leakage in CI Logs
**Description:** workflow failure prints request headers, token values, or API key to build logs.
**Impact:** credential compromise and downstream unauthorized API use.
**Required controls:**
* proactive masking on secret load
* never stringify auth headers or config
* sanitize structured HTTP client errors

### Scenario 4 — Public Receipt Over-Disclosure
**Description:** unauthenticated receipt retrieval returns private metadata that should remain non-public.
**Impact:** partner data leakage, privacy issues, control failure.
**Required controls:**
* default redacted public view
* explicit allowlist for public fields
* regression tests for non-public fields

### Scenario 5 — Partner Demo Access Persistence
**Description:** stale or copied partner cookie remains valid indefinitely or beyond intended review period.
**Impact:** unauthorized access to pre-release demos or partner materials.
**Required controls:**
* signed `exp`
* bounded cookie age
* route-scoped verification where needed
* secret rotation process for partner sessions

---

## 9. Security Assumptions

These assumptions should be made explicit because invalid assumptions create hidden risk.

* TLS termination is correctly configured by the hosting platform.
* production secrets are injected securely and not committed to source control.
* signing keys are unique to environment and not reused across dev and prod.
* API key scope definitions are enforced consistently across routes.
* receipt signing payloads are canonicalized consistently.
* public receipt views intentionally reveal only non-sensitive fields.
* optional or experimental systems do not block core verification.

---

## 10. Controls Matrix

| Control Area           | Expected Control                                | Status Guidance     |
| ---------------------- | ----------------------------------------------- | ------------------- |
| API auth               | scoped API keys per route                       | production-required |
| Webhook auth           | HMAC SHA-256 + timing-safe compare              | production-required |
| Replay defense         | delivery ID replay rejection / idempotency      | production-required |
| Session integrity      | signed payload with `iat` / `exp`               | production-required |
| Receipt redaction      | public allowlist response model                 | production-required |
| Secret handling        | no secret logging, proactive masking            | production-required |
| Token lifecycle        | short-lived installation tokens, no persistence | production-required |
| Experimental isolation | dev-only features clearly marked                | production-required |
| Optional subsystems    | non-blocking chain / proof extensions           | production-required |

---

## 11. Out-of-Scope / Experimental Controls

These may exist in code or roadmap but should not be presented as production dependencies unless upgraded intentionally.

### Chain Anchoring
Keep optional until:
* anchor batching is implemented
* anchor failures are asynchronous and non-blocking
* chain choice and reference format are stable
* verification path is documented and tested

### ZKP Attestation
Keep experimental until:
* circuits are versioned and frozen
* proofs are reproducible
* verifier compatibility is stable
* test vectors and failure cases are documented
* proofs do not become a hidden availability dependency

---

## 12. Recommended Security Review Checklist

### Before Release
* verify all protected routes require intended auth
* verify public routes return only intended fields
* verify webhook signature test coverage passes
* verify replay tests pass
* verify no secret-bearing values are logged in error paths
* verify partner-gated routes are not publicly linked
* verify env docs match runtime secret requirements

### Before Partner Demo
* confirm partner password rotation plan
* confirm session expiry duration is appropriate
* confirm demo routes are excluded from public nav and indexing
* confirm experimental features are labeled as such

### Before Enterprise / Audit Review
* produce updated trust boundary diagram
* map controls to SOC 2 / ISO 27001 evidence expectations
* document key-management responsibilities
* document incident handling for leaked API keys or compromised webhook secret

---

## 13. Recommended Next Artifacts

1. **Data Classification Matrix**
   * public receipt fields
   * internal receipt fields
   * secrets / credentials
   * partner-private materials

2. **Incident Response Runbook**
   * leaked API key
   * leaked GitHub webhook secret
   * compromised GitHub App private key
   * unexpected receipt mismatch

3. **Control Mapping Appendix**
   * SOC 2 CC6 / CC7 / CC8 mapping
   * ISO 27001 Annex A alignment

---

## 14. Final Position

TrustSignal’s production trust boundary should remain intentionally narrow and conservative:
* **production:** hashing, signed receipts, verification, scoped auth, webhook integrity, redaction, gated demos
* **experimental:** chain anchoring, ZKP attestation, advanced multi-signal fusion

That boundary makes the system easier to defend, easier to explain, and more credible to technical evaluators, partners, and auditors.
