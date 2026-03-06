# 10-Minute Talk Track: TrustSignal x Vanta Technology Partnership

Meeting date: 2026-03-06
Goal: Secure agreement on a 30-day technical evaluation + pilot scope.

## 0:00-0:45 | Opening and Framing

"Thanks for making time. We want to discuss a technology partnership where Vanta remains the compliance workflow system of record, and TrustSignal provides cryptographic document verification as an embedded capability."

"This is not a compliance audit review meeting. This is about product and partnership fit: can we jointly deliver faster, stronger verification evidence for Vanta customers in high-stakes workflows?"

## 0:45-2:00 | The Problem We Solve for Vanta Customers

"Many teams using compliance automation still handle document authenticity checks manually or through fragmented tools."

"That creates three issues: delay, inconsistent evidence quality, and weak audit defensibility."

"Our proposal is to make authenticity verification an API-native step in Vanta workflows, so evidence lands directly in the control timeline."

## 2:00-3:30 | Partnership Model Proposal

"We recommend a phased partnership."

1. "Phase 1: API integration pilot with 1-2 shared design customers."
2. "Phase 2: co-sell/referral motion in fintech, healthcare, legal, and real estate."
3. "Phase 3: optional marketplace packaging and selective white-label for enterprise accounts."

"This gives fast time-to-value without forcing either team into a heavy upfront product commitment."

## 3:30-5:30 | Technical Integration Story (Demo Narrative)

"Here is the flow: Vanta workflow submits a verification request to TrustSignal, receives a verification ID, then retrieves a structured result and cryptographic receipt."

"The payload includes decision, normalized status, checks, receipt hash, and optional chain anchor references."

"Vanta can store that payload as evidence immediately, without changing its core UX model."

"For the pilot, we can demonstrate this with current endpoints and provide a stable `/partner/v1/*` contract for production rollout."

## 5:30-6:45 | Why This Is Differentiated

"Most tools focus on document workflow completion. We focus on proof-grade verification outputs."

"In plain terms: we return authenticity proof artifacts, not just a pass/fail screenshot."

"That gives Vanta customers stronger, tamper-evident evidence trails in audit scenarios."

## 6:45-7:45 | SOC 2 Bridge (Your Original Positioning)

"This partnership also supports TrustSignal's SOC 2 trajectory and gives Vanta customers clearer control evidence."

"We want to be precise: we are in SOC 2 readiness mode, with documented controls and integration evidence patterns, and we can align pilot outputs to control mapping from day one."

"So the value is immediate for Vanta workflows now, while we continue formal assurance maturity."

## 7:45-8:45 | Commercial and Operating Model

"Commercially, we can start with a pilot model and then convert to usage-based partnership terms."

"We can support referral, co-sell, or embedded models depending on which motion Vanta prefers."

"Operationally, we can commit pilot SLA targets, scoped auth models (API key/OAuth/mTLS options), and defined escalation paths."

## 8:45-9:30 | Direct Ask

"Our ask today is straightforward: approve a 30-day technical evaluation with named product and engineering owners on both sides."

"Success criteria: one live workflow integrated, evidence payload accepted into Vanta control timeline, and sub-2-second verification response on pilot dataset."

## 9:30-10:00 | Close + Discovery Questions

"Before we lock scope, we want to align on your top priority."

Ask:
1. "Which customer workflow is most urgent for document authenticity verification?"
2. "Who should own technical integration on your side: product, platform, or security engineering?"
3. "Would you prefer starting with integration-only, or integration plus a joint go-to-market pilot?"

"If alignment looks good, we can schedule a technical working session next week and move directly into pilot setup."

---

## Backup Objection Responses (Use if needed)

- "How is this different from DocuSign/Notarize?"
  - "Those tools handle signing/notarization workflows; we provide cryptographic verification evidence designed for compliance ingestion."

- "What if blockchain is slow?"
  - "Decision and receipt generation are not blocked on chain finality; anchoring can complete asynchronously."

- "Is this SOC 2 certified today?"
  - "We position this accurately as SOC 2 readiness in progress, with concrete control and evidence workflows in place."
