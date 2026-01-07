# Curl examples

Start server:

```sh
npm run start:verify
```

Verify a JWT:

```sh
curl -i -sS -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  -d '{"jwt":"PASTE_JWT_HERE"}'
```

Expected success shape:

```json
{"verified":true}
```

Revoke a JWT by jti:

```sh
curl -i -sS -X POST http://localhost:3000/api/revoke \
  -H 'content-type: application/json' \
  -d '{"jti":"PASTE_JTI_HERE"}'
```

Expected revoke success shape:

```json
{"revoked":true}
```
