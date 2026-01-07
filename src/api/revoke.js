const { execFileSync } = require('child_process');

function dbPath() {
  return process.env.DB_PATH || './attestations.sqlite';
}

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqliteExec({ sql }) {
  execFileSync('sqlite3', ['-noheader', '-batch', dbPath(), sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

async function handleRevoke(req, res) {
  try {
    const body = await readJson(req);
    const jti = body.jti;
    if (!jti) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ revoked: false, error: 'missing_jti' }));
      return;
    }

    const revokedAt = new Date().toISOString();
    sqliteExec({
      sql: `INSERT OR REPLACE INTO revocations(jti, revoked_at) VALUES (${sqlStringLiteral(jti)}, ${sqlStringLiteral(revokedAt)});`,
    });

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ revoked: true }));
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ revoked: false, error: 'bad_request' }));
  }
}

module.exports = {
  handleRevoke,
};
