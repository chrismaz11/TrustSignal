# Infrastructure Readiness, SLA, and Security Package

## 1) Deployment and SLA Proposal

Current deployment posture (from repo and docs):
- Serverless API architecture with Vercel-compatible entrypoint.
- Health/status/metrics endpoints implemented (`/api/v1/health`, `/api/v1/status`, `/api/v1/metrics`).

Partnership SLA proposal:
- Pilot SLA: 99.9% monthly API availability.
- GA target SLA: 99.95% monthly API availability.
- P1 response objective: acknowledge within 30 minutes, mitigation updates every 60 minutes.

Scalability and throttling (proposal):
- Default partner quota: 100 RPM, burst 300 RPM.
- Enterprise tier: 1,000 RPM sustained with negotiated burst.
- Idempotency required for safe retries.

## 2) Auth and Integration Security Options

Supported now:
- API key header (`x-api-key`) with scoped permissions (`verify`, `read`, `anchor`, `revoke`).

Partnership options to offer:
- OAuth2 client credentials for enterprise identity governance.
- IP allowlisting for trusted egress ranges.
- mTLS for high-assurance integrations.
- Signed webhooks using HMAC SHA-256.

## 3) Monitoring and Support

Technical monitoring posture:
- Request count and latency metrics are instrumented.
- Health and readiness style endpoints available.

Partnership support model (proposal):
- Shared partner Slack/Teams channel for P1/P2 incidents.
- Named technical owner and partner success owner.
- Weekly integration health review during pilot.
- Escalation matrix:
  - P1: engineering on-call + incident lead
  - P2/P3: business-hours engineering + partner manager

## 4) Compliance and Assurance Artifacts

Artifacts already represented in repo docs:
- SOC 2 readiness kickoff documentation.
- Security audit and threat model documentation.
- Staging evidence capture scripts and reports.

Artifacts to provide in partner data room:
- Security questionnaire responses.
- Latest architecture diagram and data flow.
- Pen test summary (if available) or scheduled date.
- Insurance and legal/commercial contact package.

## 5) Commercial Terms for Discussion

Proposed initial framework:
- Usage tiers:
  - Starter: up to 50k verifications/month
  - Growth: up to 250k/month
  - Enterprise: 250k+/month with negotiated throughput
- Partnership model options:
  - Referral fee: 15-20% first-year net revenue on sourced deals
  - Co-sell: joint account plan, no referral fee where both teams carry quota
  - Embedded/white-label: platform fee + per-verification volume pricing
- Pilot commercial structure:
  - 60-day pilot with capped usage and success milestones
  - Conversion to annual contract on KPI attainment

## 6) Risks to Address Before Final Commitment

- Worktree is not clean; release hygiene step is still required before external demo branch hardening.
- Need confirmed production SLO dashboard evidence for enterprise procurement flow.
- Need explicit legal position on data retention and document-handling guarantees in final MSA/security addendum.
