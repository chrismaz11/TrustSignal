# Supabase DB Security Evidence

- Captured at (UTC): 2026-02-28T00:41:40Z
- Supabase project ref: `[redacted]`
- DB target: `[redacted]`

## 1. SSL Enforcement (Provider Control)
Command:
`supabase --experimental ssl-enforcement get --project-ref [redacted]`

Output:
```text
SSL is being enforced.
```

## 2. Encryption-at-Rest Control Presence (Redacted)
Command:
`supabase --experimental encryption get-root-key --project-ref [redacted]`

Redacted output summary:
```text
len=64,prefix=e36b6603...,suffix=73cb7c41
```

Interpretation: root encryption key is present; full key material intentionally excluded from evidence artifacts.

## 3. Live DB TLS Session Proof
Command:
`PGPASSWORD='***' psql "host=[redacted] port=5432 dbname=postgres user=[redacted] sslmode=require connect_timeout=8" -Atc "select 'ssl='||ssl::text||',version='||version||',cipher='||cipher from pg_stat_ssl where pid=pg_backend_pid();"`

Output:
```text
ssl=true,version=TLSv1.3,cipher=TLS_AES_256_GCM_SHA384
```

## 4. Control Conclusion
- DB provider SSL enforcement: enabled.
- Connection policy: `sslmode=require` verified in live DB session.
- Transport encryption: active with negotiated TLS protocol/cipher.
