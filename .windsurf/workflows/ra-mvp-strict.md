# Standing Orders (must follow)
- Strict scope: ingest → normalize → issue JWT VC → verify → revoke/status
- No hallucinations: if file not visible, request it
- No new deps without justification + my approval
- Every step ends with a runnable command + expected output
- Stop if out-of-scope

Scan the repo structure and list only:
1) frameworks detected (Next/Node/etc)
2) package manager detected
3) existing DB layer (Prisma/etc)
4) any existing auth/crypto libs
Then propose the next 3 smallest steps for our MVP. Do not write code yet.

Create the minimum file plan for the MVP with exact paths only (no prose):
- schema (DB)
- vc issue/verify library
- 2 API routes: /api/verify and /api/revoke
- 1 ingest script (CSV)
- 1 tiny docs file with curl examples
List files to create/edit and nothing else.

Implement the file plan now.
Constraints:
- Only edit/create the files you listed.
- For each file: show a unified diff (---/+++ style).
- After code: provide the exact commands to run in order, and what success looks like.
Stop after the first runnable milestone: verify endpoint returns verified:true for a valid JWT.

Debug this error using only evidence from the repo + the terminal output I pasted.
Do NOT propose speculative fixes.
Give:
1) root cause in 1 sentence
2) the smallest code change to fix it (diff)
3) the rerun command

Before adding any dependency or tool:
- Explain why it is required (1 sentence)
- Show an alternative using existing dependencies
- Recommend one
Do not run installs; wait for me to run them.

We will not store private keys in the DB.
Assume issuer private JWK comes from .env.local only.
If you need a key, provide a safe local dev generation method and the exact env var names.
Never print private keys in logs or responses.

Verification rules for this MVP:
- Verify JWT signature using issuer public JWK from DB by issuer DID (iss).
- Check exp/nbf/iat standard JWT validation.
- Check credential status in DB by jti: if revoked => return HTTP 409.
- Return payload only if verified:true; otherwise return error string.
Implement exactly this, nothing more.

Stop immediately if:
- You need external web info
- You need a file you can’t see
- You want to add features beyond ingest/issue/verify/revoke
Ask me for the minimum needed input instead.