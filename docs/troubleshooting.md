# Troubleshooting

This page is written for beginners. Each issue includes what happened, why it happens, and how to fix it.

## Action not running

What happened  
You expected a GitHub Action to run, but nothing happens.

Why it happens  
- The workflow file is not in `.github/workflows/`.
- The workflow only runs on specific events (for example, `workflow_dispatch` is manual).
- YAML indentation is wrong.

How to fix it  
1) Confirm the file path is `.github/workflows/verify.yml`.  
2) In GitHub, open **Actions** and run the workflow (if it uses `workflow_dispatch`).  
3) Fix indentation (YAML is spacing-sensitive).

## API key missing

What happened  
You see an error about a missing API key / API base URL.

Why it happens  
Managed mode needs secrets to talk to the TrustSignal API.

How to fix it  
1) Add the secrets in GitHub: **Settings → Secrets and variables → Actions**  
2) Add:
   - `TRUSTSIGNAL_API_BASE_URL` (example: `https://api.trustsignal.dev`)
   - `TRUSTSIGNAL_API_KEY`
3) Reference them from the workflow using `${{ secrets.… }}`.

## Verification failed

What happened  
The app or action says verification failed.

Why it happens  
Usually, the file you’re checking is not the exact same file the receipt was made for.

How to fix it  
- If the file should not have changed: investigate your build steps and dependencies.  
- If the file changed on purpose: generate a new receipt to create a new baseline.

## Artifact drift detected

What happened  
You see:

```text
✖ Artifact drift detected
File no longer matches original receipt
```

Why it happens  
The file’s fingerprint today doesn’t match the fingerprint stored in the receipt. That means the file changed.

How to fix it  
- If the change was unexpected: treat it like a “something modified my file” alert and investigate.  
- If the change was expected: generate a new receipt and store it as the new baseline.

## Network error

What happened  
You see timeouts or “network error” while using managed mode.

Why it happens  
- The API base URL is wrong.
- The API is temporarily unreachable from your environment.

How to fix it  
1) Double-check the base URL.  
2) Retry (temporary issues happen).  
3) If it keeps failing, use local mode while you troubleshoot managed mode.

