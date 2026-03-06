# API Usage Examples (cURL, Node.js, Python)

## Variables

```bash
export BASE_URL="https://staging-api.trustsignal.ai"
export API_KEY="<partner-api-key>"
export VERIFICATION_ID="<from-submit-response>"
```

## 1) Submit Verification (cURL)

```bash
curl -sS -X POST "$BASE_URL/api/v1/verify" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "bundleId": "vanta-demo-001",
    "transactionType": "DEED_TRANSFER",
    "ron": {
      "provider": "DemoRON",
      "notaryId": "NTR-100",
      "commissionState": "IL",
      "sealPayload": "demo-seal"
    },
    "doc": {
      "docHash": "0x4ce3a69b2cb4854f8f4e9d89e2cb38ce4d9482d937f3418d57a6973012b6e278",
      "county": "Cook",
      "state": "IL",
      "parcelId": "17-20-226-014-0000",
      "grantor": "Jane Seller",
      "grantee": "Acme Title LLC"
    },
    "policy": {
      "profile": "STANDARD_IL"
    }
  }'
```

## 2) Fetch Vanta-formatted Result (cURL)

```bash
curl -sS "$BASE_URL/api/v1/integrations/vanta/verification/$VERIFICATION_ID" \
  -H "x-api-key: $API_KEY"
```

## 3) Fetch Receipt (cURL)

```bash
curl -sS "$BASE_URL/api/v1/receipt/$VERIFICATION_ID" \
  -H "x-api-key: $API_KEY"
```

## 4) Node.js Example with Retry

```javascript
const baseUrl = process.env.BASE_URL;
const apiKey = process.env.API_KEY;

async function withRetry(fn, attempts = 4) {
  let delay = 250;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

const response = await withRetry(async () => {
  const res = await fetch(`${baseUrl}/api/v1/integrations/vanta/verification/${process.env.VERIFICATION_ID}`, {
    headers: { 'x-api-key': apiKey }
  });
  if (res.status >= 500 || res.status === 429) throw new Error(`retryable ${res.status}`);
  if (!res.ok) throw new Error(`non-retryable ${res.status}`);
  return res.json();
});

console.log(response);
```

## 5) Python Example with Retry

```python
import os
import time
import requests

base_url = os.environ["BASE_URL"]
api_key = os.environ["API_KEY"]
verification_id = os.environ["VERIFICATION_ID"]

url = f"{base_url}/api/v1/integrations/vanta/verification/{verification_id}"
headers = {"x-api-key": api_key}

for attempt in range(4):
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 200:
        print(resp.json())
        break
    if resp.status_code in (429, 500, 502, 503, 504):
        if attempt == 3:
            raise RuntimeError(f"retry limit reached: {resp.status_code}")
        time.sleep(0.25 * (2 ** attempt))
        continue
    raise RuntimeError(f"non-retryable: {resp.status_code} {resp.text}")
```

## Error Handling Guidance

- `401/403`: auth issue; rotate/validate credentials and scopes.
- `404`: verification ID missing or expired; reconcile workflow IDs.
- `409`: idempotency conflict; fetch existing record and continue.
- `429`: obey `Retry-After` and exponential backoff.
- `5xx`: retry with jitter and open incident if persistent.
