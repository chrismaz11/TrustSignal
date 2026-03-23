const http = require('http');
const { URL } = require('url');
const { ethers } = require('ethers');
const { loadEnvLocal, getAnchorConfig } = require('../lib/env');
const { handleReceipt } = require('./receipt');
const { decodeJwtPayloadUnverified, verifyVcJwt } = require('../lib/vc-jwt');
const { getDb } = require('../lib/db');

loadEnvLocal();
const { db } = getDb();
const anchorConfig = getAnchorConfig();
const anchorProvider = new ethers.JsonRpcProvider(anchorConfig.rpcUrl);
let lastAnchorTxHash = null;

function sqlSelectFirstValue(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  if (!row) return '';
  const first = Object.values(row)[0];
  return first == null ? '' : String(first);
}

function sqlExists(sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return !!row;
}

function sqlRun(sql, params = []) {
  db.prepare(sql).run(...params);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('body_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function verifyAndRespond(jwt, res, { includeSubject = false } = {}) {
  if (!jwt) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'missing_jwt' }));
    return;
  }

  let payload;
  try {
    payload = decodeJwtPayloadUnverified(jwt);
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'bad_encoding' }));
    return;
  }

  const iss = payload?.iss;
  const jti = payload?.jti;
  if (!iss) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'missing_iss' }));
    return;
  }
  if (!jti) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'missing_jti' }));
    return;
  }

  const publicJwkJson = sqlSelectFirstValue(
    'SELECT public_jwk_json FROM issuers WHERE did = ? LIMIT 1',
    [iss]
  );
  if (!publicJwkJson) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'unknown_issuer' }));
    return;
  }

  const revoked = sqlExists(
    'SELECT 1 FROM revocations WHERE jti = ? LIMIT 1',
    [jti]
  );
  if (revoked) {
    res.writeHead(409, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'revoked' }));
    return;
  }

  const result = await verifyVcJwt({
    jwt,
    publicJwkJson,
    expectedIssuer: iss,
  });
  if (!result.verified) {
    let err = result.error;
    if (err === 'missing_subject_required_fields' || err === 'missing_subject_docType') {
      err = 'invalid_attestation_missing_fields';
    }
    const status = err === 'invalid_attestation_missing_fields' ? 400 : 200;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: err }));
    return;
  }

  const cs = result.payload?.vc?.credentialSubject || {};
  const resResult = cs.result || 'PASS';
  const resFlags = Array.isArray(cs.flags) ? cs.flags : [];
  const bindingMode = cs.contentBindingMode || 'attested';

  const body = {
    verified: true,
    result: resResult,
    flags: resFlags,
    contentBindingMode: bindingMode,
  };
  if (includeSubject) {
    body.subject = {
      documentHash: cs.documentHash,
      receiptHash: cs.receiptHash,
      jurisdiction: cs.jurisdiction,
      docType: cs.docType,
      notaryId: cs.notaryId,
      result: resResult,
      flags: resFlags,
      contentBindingMode: bindingMode,
      operatorConfirmed: !!cs.operatorConfirmed,
    };
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleVerify(req, res) {
  try {
    const body = await readJson(req);
    await verifyAndRespond(body.jwt, res, { includeSubject: false });
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'bad_request' }));
  }
}

async function handleRevoke(req, res) {
  try {
    const body = await readJson(req);
    let jti = body.jti;

    if (!jti && body.jwt) {
      try {
        const payload = decodeJwtPayloadUnverified(body.jwt);
        jti = payload?.jti;
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad_jwt' }));
        return;
      }
    }

    if (!jti) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'missing_jti' }));
      return;
    }

    sqlRun('INSERT OR REPLACE INTO revocations (jti, revoked_at) VALUES (?, ?)', [
      jti,
      new Date().toISOString()
    ]);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ revoked: true }));
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'bad_request' }));
  }
}

async function handleAnchorStatus(req, res) {
  try {
    const chainIdHex = await Promise.race([
      anchorProvider.send('eth_chainId', []),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    const chainId = Number(chainIdHex);
    if (chainId !== anchorConfig.chainId) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'anchor_network_mismatch', expected: anchorConfig.chainId, actual: chainId }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ chainId, explorerBaseUrl: anchorConfig.explorerBaseUrl, lastAnchorTxHash, network: anchorConfig.network }));
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'anchor_rpc_unreachable_or_incompatible' }));
  }
}

function startServer({ port }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/verify') {
      return handleVerify(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/revoke') {
      return handleRevoke(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/receipt') {
      return handleReceipt(req, res);
    }
    if (req.method === 'GET' && req.url.startsWith('/api/anchor/status')) {
      return handleAnchorStatus(req, res);
    }
    if (req.method === 'GET' && req.url.startsWith('/api/receipt/status')) {
      const url = new URL(req.url, `http://localhost:${port}`);
      const jwt = url.searchParams.get('jwt') || '';
      return verifyAndRespond(jwt, res, { includeSubject: true });
    }
    if (req.method === 'POST' && req.url === '/api/anchor') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const receiptHash = parsed.receiptHash;
          if (!receiptHash || typeof receiptHash !== 'string') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'missing_receipt_hash' }));
            return;
          }
          let chainId;
          try {
            const chainIdHex = await Promise.race([
              anchorProvider.send('eth_chainId', []),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
            ]);
            chainId = Number(chainIdHex);
          } catch {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'polygon_anchor_unreachable' }));
            return;
          }
          if (chainId !== anchorConfig.chainId) {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'anchor_network_mismatch', expected: anchorConfig.chainId, actual: chainId }));
            return;
          }

          // Idempotent: reuse lastAnchorTxHash if already set for this hash (simple memory cache)
          if (!global.__anchorCache) global.__anchorCache = {};
          if (global.__anchorCache[receiptHash]) {
            const txHash = global.__anchorCache[receiptHash];
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
              anchored: true,
              network: anchorConfig.network,
              chainId,
              txHash,
              explorerUrl: anchorConfig.explorerBaseUrl ? anchorConfig.explorerBaseUrl.replace(/\/$/, '') + '/' + txHash : undefined,
            }));
            return;
          }

          // Anchor only the hash as calldata (no contract interaction; simple eth_call-style send)
          const wallet = ethers.Wallet.createRandom().connect(anchorProvider); // ephemeral wallet for placeholder; real anchoring would use signer
          const tx = {
            to: wallet.address,
            data: receiptHash,
            value: 0,
          };
          let sent;
          try {
            sent = await wallet.sendTransaction(tx);
          } catch {
            res.writeHead(502, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'polygon_anchor_unreachable' }));
            return;
          }

          const txHash = sent.hash;
          lastAnchorTxHash = txHash;
          global.__anchorCache[receiptHash] = txHash;

          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({
            anchored: true,
            network: anchorConfig.network,
            chainId,
            txHash,
            explorerUrl: anchorConfig.explorerBaseUrl ? anchorConfig.explorerBaseUrl.replace(/\/$/, '') + '/' + txHash : undefined,
          }));
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'bad_request' }));
        }
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/demo') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>TrustSignal Demo</title>
<style>
body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width:820px; margin:24px auto; padding:0 12px}
.row{margin:12px 0}
.status{font-weight:700}
.ok{color:#0b8a0b}
.warn{color:#c77d00}
.err{color:#b00020}
textarea{width:100%; height:120px}
pre{background:#f6f8fa; padding:8px; overflow:auto}
button{padding:8px 12px}
</style>
</head>
<body>
<h1>TrustSignal Demo</h1>

<section class="row">
  <h2>1) Generate Receipt</h2>
  <form id="receiptForm">
    <div class="row"><input type="file" id="file" name="file" accept="application/pdf" required></div>
    <div class="row">
      <label>Jurisdiction <input name="jurisdiction" placeholder="CA-LA"/></label>
      <label>Doc Type <input name="docType" value="DEED"/></label>
      <label>Notary ID <input name="notaryId"/></label>
    </div>
    <div class="row">
      <label>Binding Mode
        <select name="contentBindingMode" id="bindingMode">
          <option value="attested" selected>Attested</option>
          <option value="text_match">Text Match</option>
          <option value="none">None (debug)</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label><input type="checkbox" id="operatorConfirmed" name="operatorConfirmed" value="true" /> I confirm these fields match the uploaded document</label>
    </div>
    <div class="row"><button type="submit">Generate Receipt</button></div>
  </form>
    <div class="row"><pre id="receiptOut"></pre></div>
  <div class="row">
    <label>Attestation JWT</label>
    <textarea id="jwtOut"></textarea>
  </div>
</section>

<section class="row">
  <h2>2) Verify JWT</h2>
  <div class="row">
    <textarea id="jwtIn" placeholder="Paste JWT here"></textarea>
  </div>
  <div class="row"><button id="verifyBtn">Verify</button></div>
  <div class="row status" id="status"></div>
</section>

<section class="row">
  <h2>Anchor Settings</h2>
  <div class="row" id="anchorInfo">Loading...</div>
</section>

<script>
const form = document.getElementById('receiptForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const mode = document.getElementById('bindingMode').value;
  const confirmed = document.getElementById('operatorConfirmed').checked;
  fd.set('contentBindingMode', mode);
  fd.set('operatorConfirmed', confirmed ? 'true' : 'false');
  const resp = await fetch('/api/receipt', { method: 'POST', body: fd });
  const txt = await resp.text();
  let data; try{ data = JSON.parse(txt) }catch{ data = { error: 'bad_json' } }
  const ro = data.receipt || {};
  document.getElementById('receiptOut').textContent = JSON.stringify(data.receipt || data, null, 2);
  if (data.attestation_jwt) {
    document.getElementById('jwtOut').value = data.attestation_jwt;
  document.getElementById('jwtIn').value = data.attestation_jwt;
  }
  const receiptStatus = document.getElementById('status');
  if (ro.result === 'FLAG') {
    receiptStatus.textContent = 'FLAGGED ' + (Array.isArray(ro.flags) && ro.flags.length ? ro.flags.join(', ') : '');
    receiptStatus.className = 'status warn';
  } else if (ro.result === 'PASS') {
    receiptStatus.textContent = 'VERIFIED';
    receiptStatus.className = 'status ok';
  } else {
    receiptStatus.textContent = '';
  }
});

document.getElementById('verifyBtn').addEventListener('click', async () => {
  const jwt = document.getElementById('jwtIn').value.trim();
  const resp = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jwt }) });
  const ok = resp.status === 200;
  const body = await resp.json().catch(()=>({verified:false,error:'bad_json'}));
  const el = document.getElementById('status');
  if (ok && body.verified && body.result === 'PASS') {
    el.textContent = 'VERIFIED (PASS)';
    el.className = 'status ok';
    return;
  }
  if (ok && body.verified && body.result === 'FLAG') {
    const flags = Array.isArray(body.flags) ? body.flags.join(', ') : '';
    el.textContent = 'FLAGGED' + (flags ? ' — ' + flags : '');
    el.className = 'status warn';
    return;
  }
  if (resp.status === 409) { el.textContent = 'REVOKED'; el.className = 'status warn'; return; }
  if (ok && !body.verified) { el.textContent = 'FLAGGED' + (body.error ? ' — ' + body.error : ''); el.className = 'status warn'; return; }
  el.textContent = 'INVALID' + (body.error ? ' — ' + body.error : '');
  el.className = 'status err';
});

async function loadAnchor() {
  try {
    const resp = await fetch('/api/anchor/status');
    const data = await resp.json();
    const div = document.getElementById('anchorInfo');
    if (resp.status !== 200) {
      div.textContent = 'Anchor RPC unavailable';
      return;
    }
    const parts = ['chainId=' + data.chainId];
    if (data.lastAnchorTxHash) {
      if (data.explorerBaseUrl) {
        parts.push('lastTx: ' + data.explorerBaseUrl.replace(/\\/$/, '') + '/tx/' + data.lastAnchorTxHash);
      } else {
        parts.push('lastTx: ' + data.lastAnchorTxHash);
      }
    }
    div.textContent = parts.join(' | ');
  } catch {
    const div = document.getElementById('anchorInfo');
    div.textContent = 'Anchor RPC unavailable';
  }
}
loadAnchor();
</script>
</body>
</html>`);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(port);
  return server;
}

module.exports = {
  handleVerify,
  handleRevoke,
  startServer,
};

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  startServer({ port });
  // eslint-disable-next-line no-console
  console.log(`verify server listening on http://localhost:${port}`);
}
