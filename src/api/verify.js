const http = require('http');
const { execFileSync } = require('child_process');

const { decodeJwtUnsafe, verifyVcJwt } = require('../lib/vc-jwt');
const { handleRevoke } = require('./revoke');

function dbPath() {
  return process.env.DB_PATH || './attestations.sqlite';
}

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqliteQueryScalar({ sql }) {
  const out = execFileSync('sqlite3', ['-noheader', '-batch', dbPath(), sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const trimmed = out.trim();
  return trimmed.length ? trimmed : null;
}

function getIssuerPublicJwkJsonByDid(did) {
  return sqliteQueryScalar({
    sql: `SELECT public_jwk_json FROM issuers WHERE did = ${sqlStringLiteral(did)} LIMIT 1;`,
  });
}

function isRevoked(jti) {
  const row = sqliteQueryScalar({
    sql: `SELECT 1 FROM revocations WHERE jti = ${sqlStringLiteral(jti)} LIMIT 1;`,
  });
  return row === '1';
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
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handleVerify(req, res) {
  try {
    const body = await readJson(req);
    const jwt = body.jwt;

    let decoded;
    try {
      decoded = decodeJwtUnsafe(jwt);
    } catch {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: 'bad_encoding' }));
      return;
    }

    const iss = decoded?.payload?.iss;
    if (!iss) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: 'missing_iss' }));
      return;
    }

    const publicJwkJson = getIssuerPublicJwkJsonByDid(iss);
    if (!publicJwkJson) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: 'unknown_issuer' }));
      return;
    }

    let publicJwk;
    try {
      publicJwk = JSON.parse(publicJwkJson);
    } catch {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: 'bad_issuer_key' }));
      return;
    }

    const result = verifyVcJwt({ jwt, publicJwk });
    if (!result.verified) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: result.error || 'verify_failed' }));
      return;
    }

    const jti = result?.payload?.jti;
    if (jti && isRevoked(jti)) {
      res.writeHead(409, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ verified: false, error: 'revoked' }));
      return;
    }

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: true }));
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verified: false, error: 'bad_request' }));
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

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(port);
  return server;
}

module.exports = {
  handleVerify,
  startServer,
};

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  startServer({ port });
  // eslint-disable-next-line no-console
  console.log(`verify server listening on http://localhost:${port}`);
}
