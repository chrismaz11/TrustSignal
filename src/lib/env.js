const fs = require('fs');
const path = require('path');

function stripQuotes(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const text = fs.readFileSync(envPath, 'utf8');
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1);
    if (!key) continue;
    if (process.env[key] !== undefined) continue;
    process.env[key] = stripQuotes(rawValue);
  }
}

function getDbPath() {
  return process.env.DB_PATH || 'attestations.sqlite';
}

function requireFileExists(p) {
  if (!p) throw new Error('path_required');
  if (!fs.existsSync(p)) {
    throw new Error(`file_not_found:${p}`);
  }
  return p;
}

function getIssuerPrivateJwkPath() {
  const p = process.env.ISSUER_PRIVATE_JWK_PATH || path.join('keys', 'issuer.private.jwk.json');
  return requireFileExists(p);
}

function getIssuerPublicJwkPath() {
  const p = process.env.ISSUER_PUBLIC_JWK_PATH || path.join('keys', 'issuer.public.jwk.json');
  return requireFileExists(p);
}

function readJsonFile(p) {
  const txt = fs.readFileSync(p, 'utf8');
  return JSON.parse(txt);
}

function getIssuerPrivateJwk() {
  const p = getIssuerPrivateJwkPath();
  return readJsonFile(p);
}

function getIssuerPublicJwk() {
  const p = getIssuerPublicJwkPath();
  return readJsonFile(p);
}

function getIssuerDid() {
  return process.env.ISSUER_DID || 'did:example:trustsignal-issuer';
}

function getAnchorConfig() {
  const rpcUrl =
    process.env.ANCHOR_RPC_URL ||
    'https://rpc-amoy.polygon.technology';
  const chainId = Number(process.env.ANCHOR_CHAIN_ID || 80002);
  const explorerBaseUrl =
    process.env.ANCHOR_EXPLORER_BASE_URL ||
    'https://amoy.polygonscan.com/tx/';
  const network = process.env.ANCHOR_NETWORK || 'polygon-amoy';
  return { rpcUrl, chainId, explorerBaseUrl, network };
}

module.exports = {
  loadEnvLocal,
  getDbPath,
  getIssuerPrivateJwkPath,
  getIssuerPublicJwkPath,
  getIssuerPrivateJwk,
  getIssuerPublicJwk,
  getIssuerDid,
  getAnchorConfig,
};
