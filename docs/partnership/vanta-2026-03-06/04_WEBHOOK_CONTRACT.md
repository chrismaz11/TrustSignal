# Webhook Contract (TrustSignal -> Vanta)

## Endpoint

Vanta provides a partner webhook endpoint, for example:
- `POST https://partner.vanta.com/integrations/trustsignal/webhooks`

## Security

- Header: `X-TrustSignal-Signature: sha256=<hex_hmac>`
- Header: `X-TrustSignal-Timestamp: <unix-epoch-seconds>`
- Header: `X-TrustSignal-Event-Id: <uuid>`
- Signature input: `<timestamp>.<raw_body>`
- Replay window: 5 minutes
- Idempotency key: `eventId` (Vanta should de-duplicate)

## Event Types

- `verification.completed`
- `verification.failed`
- `verification.revoked`

## Payload Shape

```json
{
  "eventId": "evt_01JQXQ1M2Q3T",
  "eventType": "verification.completed",
  "occurredAt": "2026-03-05T23:18:11.231Z",
  "partner": "trustsignal",
  "schemaVersion": "trustsignal.webhook.v1",
  "data": {
    "verificationId": "vrf_9q2...",
    "externalReference": "vanta-control-CC7-9844",
    "normalizedStatus": "PASS",
    "decision": "ALLOW",
    "receiptId": "rcpt_123",
    "receiptHash": "0xabc...",
    "anchorStatus": "ANCHORED",
    "txHash": "0xdef..."
  }
}
```

## Delivery Semantics

- At-least-once delivery.
- Retry schedule: 30s, 2m, 10m, 30m, 2h.
- Stop retrying after 24h or explicit `2xx` acknowledgment.
- Non-retry responses: `400`, `401`, `403`, `404`, `422`.
- Retry responses: `408`, `409`, `425`, `429`, `5xx`, network errors.

## Vanta Handling Guidance

1. Validate signature and timestamp before parsing payload.
2. Use `eventId` for idempotent processing.
3. Fetch full receipt from `/verify/{verificationId}/receipt` when needed.
4. Write decision + proof refs to compliance evidence timeline.
