const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function getInput(name, options = {}) {
  const envName = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  const raw = process.env[envName];
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (options.required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function getBooleanInput(name, defaultValue = false) {
  const value = getInput(name);
  if (!value) return defaultValue;

  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;

  throw new Error(`Invalid boolean input for ${name}: expected true or false`);
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    process.stdout.write(`${name}=${value}\n`);
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${String(value ?? '')}\n`, 'utf8');
}

function setFailed(message) {
  process.stderr.write(`::error::${message}\n`);
  process.exitCode = 1;
}

function sha256File(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Artifact file not found: ${absolutePath}`);
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Artifact path is not a file: ${absolutePath}`);
  }

  const hash = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(absolutePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

function validateHash(value) {
  const normalized = value.toLowerCase().replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('artifact_hash must be a valid SHA-256 hex digest');
  }
  return normalized;
}

function normalizeBaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('api_base_url must be a valid URL');
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('api_base_url must use http or https');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function getGitHubContext() {
  return {
    repository: process.env.GITHUB_REPOSITORY || undefined,
    runId: process.env.GITHUB_RUN_ID || undefined,
    workflow: process.env.GITHUB_WORKFLOW || undefined,
    actor: process.env.GITHUB_ACTOR || undefined,
    sha: process.env.GITHUB_SHA || undefined
  };
}

function buildVerificationRequest({ artifactHash, artifactPath, source }) {
  const github = getGitHubContext();
  const provider = source.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 64) || 'github-actions';

  return {
    artifact: {
      hash: artifactHash,
      algorithm: 'sha256'
    },
    source: {
      provider,
      repository: github.repository,
      workflow: github.workflow,
      runId: github.runId,
      actor: github.actor,
      commit: github.sha
    },
    metadata: {
      ...(artifactPath ? { artifactPath } : {})
    }
  };
}

function deriveStatus(responseBody) {
  return (
    responseBody.status ||
    responseBody.verificationStatus ||
    responseBody.result ||
    (responseBody.verified === true ? 'verified' : undefined) ||
    (responseBody.valid === true ? 'verified' : undefined) ||
    (responseBody.match === true ? 'verified' : undefined) ||
    'unknown'
  );
}

function extractReceiptSignature(responseBody) {
  if (typeof responseBody.receipt_signature === 'string') {
    return responseBody.receipt_signature;
  }

  if (typeof responseBody.receiptSignature === 'string') {
    return responseBody.receiptSignature;
  }

  if (
    responseBody.receiptSignature &&
    typeof responseBody.receiptSignature.signature === 'string'
  ) {
    return responseBody.receiptSignature.signature;
  }

  return '';
}

function isVerificationValid(responseBody, status) {
  if ([responseBody.valid, responseBody.verified, responseBody.match].includes(true)) {
    return true;
  }

  if ([responseBody.valid, responseBody.verified, responseBody.match].includes(false)) {
    return false;
  }

  const normalizedStatus = String(status || '').toLowerCase();
  if (['verified', 'valid', 'match', 'matched', 'success', 'ok'].includes(normalizedStatus)) {
    return true;
  }

  if (['invalid', 'mismatch', 'failed', 'error', 'tampered'].includes(normalizedStatus)) {
    return false;
  }

  return false;
}

function extractMessage(responseBody) {
  if (!responseBody || typeof responseBody !== 'object') {
    return '';
  }

  return (
    responseBody.error ||
    responseBody.message ||
    responseBody.detail ||
    responseBody.title ||
    ''
  );
}

async function parseJsonResponse(response) {
  const rawBody = await response.text();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(`TrustSignal API returned a non-JSON response with status ${response.status}`);
  }
}

async function callVerificationApi({ apiBaseUrl, apiKey, artifactHash, artifactPath, source }) {
  const endpoint = `${apiBaseUrl}/api/v1/verify`;
  const payload = buildVerificationRequest({ artifactHash, artifactPath, source });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    const message = extractMessage(responseBody);
    throw new Error(
      `TrustSignal API request failed with status ${response.status}${
        message ? `: ${message}` : ''
      }`
    );
  }

  return responseBody || {};
}

async function run() {
  try {
    const apiBaseUrl = normalizeBaseUrl(getInput('api_base_url', { required: true }));
    const apiKey = getInput('api_key', { required: true });
    const artifactPath = getInput('artifact_path');
    const providedArtifactHash = getInput('artifact_hash');
    const source = getInput('source') || 'github-actions';
    const failOnMismatch = getBooleanInput('fail_on_mismatch', true);

    if (!artifactPath && !providedArtifactHash) {
      throw new Error('Either artifact_path or artifact_hash must be provided');
    }

    if (artifactPath && providedArtifactHash) {
      throw new Error('Provide only one of artifact_path or artifact_hash');
    }

    const artifactHash = artifactPath
      ? sha256File(artifactPath)
      : validateHash(providedArtifactHash);

    const responseBody = await callVerificationApi({
      apiBaseUrl,
      apiKey,
      artifactHash,
      artifactPath,
      source
    });

    const verificationId =
      responseBody.verification_id ||
      responseBody.verificationId ||
      responseBody.id ||
      responseBody.receipt_id ||
      responseBody.receiptId ||
      '';
    const receiptId = responseBody.receipt_id || responseBody.receiptId || '';
    const status = deriveStatus(responseBody);
    const receiptSignature = extractReceiptSignature(responseBody);
    const isValid = isVerificationValid(responseBody, status);

    setOutput('verification_id', verificationId);
    setOutput('status', status);
    setOutput('receipt_id', receiptId);
    setOutput('receipt_signature', receiptSignature);

    if (failOnMismatch && !isValid) {
      throw new Error(`TrustSignal verification was not valid. Status: ${status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown action failure';
    setFailed(message);
  }
}

run();
