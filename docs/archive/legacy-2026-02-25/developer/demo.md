# Deed Shield Demo — Receipt + Verify

This demo uses Node core (no heavy deps) and the sqlite3 CLI. Keys are file-path based and not stored in SQLite.

## Prereqs
- `sqlite3` CLI available on PATH
- Node 18+
- Defaults: `DB_PATH=attestations.sqlite`, `ISSUER_PRIVATE_JWK_PATH=keys/issuer.private.jwk.json`, `ISSUER_PUBLIC_JWK_PATH=keys/issuer.public.jwk.json`. Override in `.env.local` if needed. Private keys stay on disk only.
- Anchoring defaults to Polygon Amoy (testnet): `ANCHOR_NETWORK=polygon-amoy`, `ANCHOR_RPC_URL=https://rpc-amoy.polygon.technology`, `ANCHOR_CHAIN_ID=80002`, `ANCHOR_EXPLORER_BASE_URL=https://amoy.polygonscan.com/tx/`.
- Server listens on `PORT` (default 3000); adjust the curl URLs if you set a different port.

## 1) Initialize DB

```sh
npm run init:db || (rm -f ${DB_PATH:-attestations.sqlite} && sqlite3 ${DB_PATH:-attestations.sqlite} < schema.sqlite.sql)
```

## 2) Generate issuer keys (writes keys/*.jwk.json; prints no secrets)

```sh
node scripts/gen-issuer-keys.js
```

Expected (example):
```json
{"did":"did:example:trustsignal-issuer","privateKeyPath":"keys/issuer.private.jwk.json","publicKeyPath":"keys/issuer.public.jwk.json","publicKeyFingerprint":"...sha256..."}
```

## 3) Seed issuer public JWK into SQLite

```sh
node scripts/seed-issuer-public.js
```

Expected (example):
```json
{"did":"did:example:trustsignal-issuer","dbPath":"attestations.sqlite","inserted":true}
```

## 4) Start server (verify + receipt + demo)

```sh
node src/api/verify.js
```

Expected:
```
verify server listening on http://localhost:3000
```

## 5) Issue a receipt (POST /api/receipt)

```sh
curl -sS -X POST http://localhost:3000/api/receipt \
  -H 'content-type: multipart/form-data' \
  -F file=@sample.pdf \
  -F jurisdiction=CA-LA \
  -F docType=DEED \
  -F notaryId=NOTARY-123 | tee /tmp/receipt.json
```

Expected shape:
```json
{"receipt":{"result":"PASS","flags":[]},"attestation_jwt":"eyJ..."}
```

Export JWT to a variable for convenience:
```sh
JWT=$(node -e 'const o=require("fs").readFileSync("/tmp/receipt.json","utf8"); console.log(JSON.parse(o).attestation_jwt)')
```

## 6) Verify JWT

```sh
curl -i -sS -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  -d "{\"jwt\":\"$JWT\"}"
```

Expected:
```
HTTP/1.1 200 OK
{"verified":true,"result":"PASS","flags":[]}
```

## 7) Revoke then verify → 409

Extract jti:
```sh
JTI=$(node -e "const p=process.env.JWT.split('.')[1];const b=p.replace(/-/g,'+').replace(/_/g,'/');const pad=(4-(b.length%4))%4;const json=Buffer.from(b+'='.repeat(pad),'base64').toString('utf8');process.stdout.write(JSON.parse(json).jti);" JWT="$JWT")
```

Revoke:
```sh
curl -i -sS -X POST http://localhost:3000/api/revoke \
  -H 'content-type: application/json' \
  -d "{\"jti\":\"$JTI\"}"
```

Verify again (should be 409):
```sh
curl -i -sS -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  -d "{\"jwt\":\"$JWT\"}"
```

Expected:
```
HTTP/1.1 409 Conflict
{"verified":false,"error":"revoked"}
```

## 8) Human demo page
Open http://localhost:3000/demo in a browser to try the upload + verify UI.

## Scripted demo (PASS vs FLAG, binding modes)
1) Attested unchecked → FLAG: upload a PDF with `jurisdiction=CA-LA`, `docType=DEED`, `notaryId=NOTARY-123`, bindingMode=attested, **leave checkbox unchecked** → receipt `result:"FLAG"`, `flags:["unconfirmed_metadata"]`; verify → 200 `verified:true`, `result:"FLAG"`.
2) Attested checked → PASS: same data, bindingMode=attested, checkbox checked → `result:"PASS"`, flags `[]`; verify → PASS.
3) Missing metadata → FLAG: omit jurisdiction/notary → flags include `missing_jurisdiction` / `missing_notary_id`; verify → 200 with `result:"FLAG"`.
4) Text match (optional): set bindingMode=text_match; if PDF text does not contain jurisdiction/notary markers → `metadata_not_found_in_document` or `text_extraction_failed` (no crash).
5) Revoke: take a PASS JWT `jti`, call `/api/revoke`, then re-verify → HTTP 409 `{"verified":false,"error":"revoked"}`.
6) Anchor (optional, Polygon Amoy default): POST `/api/anchor` with `{"receiptHash":"0x..."}` → returns `txHash` + Polygonscan link; if RPC unreachable, returns 502 `{"error":"polygon_anchor_unreachable"}`; if chainId mismatch, 502 `{"error":"anchor_network_mismatch"}`.
