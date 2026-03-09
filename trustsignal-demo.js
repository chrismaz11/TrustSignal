#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

let chromium;

try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Missing dependency: playwright');
  console.error('Install dependencies with `npm install` and browser binaries with `npx playwright install chromium`.');
  process.exit(1);
}

const VIEWPORT = { width: 1440, height: 900 };
const SCENARIO_PAUSE_MS = 550;
const OVERLAY_PAUSE_MS = 900;
const HASH_TICK_MS = 12;
const PROGRESS_BAR_WIDTH = 28;
const REGISTRY_DELAY_MS = 380;
const HTML_FILE_NAME = 'trustsignal-demo.html';
const ARTIFACT_FILE_NAME = 'cook-county-deed.json';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function formatUtc(date) {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function createProgressPrinter() {
  let rendered = false;

  return async function progress(label, steps, activeStepIndex) {
    const ratio = Math.max(0, Math.min(1, (activeStepIndex + 1) / steps.length));
    const filled = Math.round(PROGRESS_BAR_WIDTH * ratio);
    const empty = PROGRESS_BAR_WIDTH - filled;
    const bar = `${'='.repeat(filled)}${' '.repeat(empty)}`;
    const lines = [
      `${rendered ? '\x1b[2J\x1b[H' : ''}TrustSignal live demo`,
      `${label}`,
      `[${bar}] ${String(Math.round(ratio * 100)).padStart(3, ' ')}%`
    ];

    for (let index = 0; index < steps.length; index += 1) {
      const state = index < activeStepIndex ? '\x1b[32mDONE\x1b[0m' : index === activeStepIndex ? '\x1b[36mRUN \x1b[0m' : '\x1b[90mWAIT\x1b[0m';
      lines.push(`${state} ${steps[index]}`);
    }

    process.stdout.write(`${lines.join('\n')}\n`);
    rendered = true;
    await sleep(120);
  };
}

function buildArtifactPayload() {
  return {
    artifactType: 'Property Deed Evidence Bundle',
    artifactId: 'ART-COOK-2026-0314-00017',
    jurisdiction: 'Cook County, Illinois',
    parcelId: '17-20-226-014-0000',
    documentNumber: '2026-0314-884211',
    recordedAt: '2026-03-14T10:22:16Z',
    grantor: 'Jane Seller',
    grantee: 'Acme Title LLC',
    preparedBy: 'TrustSignal Demo Operations',
    policyProfile: 'EVIDENCE_INTEGRITY_STANDARD',
    evidence: {
      sourceRecord: 'County recorder export',
      captureMethod: 'Local deterministic demonstration',
      pageCount: 12,
      checksumAlgorithm: 'SHA-256'
    }
  };
}

function createRuntimeHtml() {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TrustSignal Evidence Integrity Demo</title>
    <style>
      :root {
        --bg: #07111f;
        --panel: rgba(10, 22, 41, 0.88);
        --panel-strong: rgba(14, 28, 49, 0.96);
        --line: rgba(143, 185, 255, 0.22);
        --ink: #eef6ff;
        --muted: #97accb;
        --accent: #4cc6ff;
        --accent-2: #a9f2c8;
        --good: #8cf5b6;
        --bad: #ff7a7a;
        --warn: #ffd282;
        --diff-same: #7eb2ff;
        --diff-change: #ff8b8b;
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 20% 20%, rgba(71, 132, 255, 0.28), transparent 28%),
          radial-gradient(circle at 80% 0%, rgba(43, 211, 173, 0.22), transparent 24%),
          linear-gradient(180deg, #08111d 0%, #061019 54%, #040a11 100%);
        overflow: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 36px 36px;
        mask-image: linear-gradient(180deg, rgba(0,0,0,0.7), transparent);
        pointer-events: none;
      }

      #stage {
        position: fixed;
        top: 26px;
        left: 26px;
        right: 26px;
        z-index: 40;
        padding: 18px 22px;
        border: 1px solid rgba(117, 173, 255, 0.3);
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(8, 23, 42, 0.92), rgba(13, 34, 60, 0.78));
        backdrop-filter: blur(18px);
        box-shadow: var(--shadow);
        transition: transform 240ms ease, opacity 240ms ease, border-color 240ms ease;
      }

      #stage.hidden {
        opacity: 0;
        transform: translateY(-16px);
      }

      #stage .eyebrow {
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent-2);
        margin-bottom: 8px;
      }

      #stage .title {
        font-size: 30px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      #stage .body {
        color: var(--muted);
        font-size: 15px;
        max-width: 980px;
      }

      #failure-flash {
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        z-index: 45;
        background:
          radial-gradient(circle at center, rgba(255, 123, 123, 0.28), rgba(255, 68, 68, 0.06) 35%, transparent 65%),
          linear-gradient(180deg, rgba(255, 42, 42, 0.16), rgba(255, 42, 42, 0));
      }

      #failure-flash.active {
        animation: failureFlash 780ms ease-out;
      }

      @keyframes failureFlash {
        0% { opacity: 0; }
        14% { opacity: 1; }
        100% { opacity: 0; }
      }

      .layout {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 22px;
        padding: 162px 26px 26px;
        height: 100vh;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(143, 185, 255, 0.14);
        background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
      }

      .panel-title {
        font-size: 18px;
        font-weight: 700;
      }

      .panel-subtitle {
        color: var(--muted);
        font-size: 13px;
      }

      .artifact-shell {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
      }

      .artifact-meta {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        padding: 20px 22px;
        border-bottom: 1px solid rgba(143, 185, 255, 0.14);
      }

      .artifact-meta .label {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .artifact-meta .value {
        font-size: 14px;
        font-weight: 600;
      }

      pre {
        margin: 0;
        padding: 22px;
        height: 100%;
        overflow: auto;
        background: rgba(2, 10, 19, 0.48);
        color: #dfe9fb;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 13px;
        line-height: 1.5;
      }

      .right-column {
        display: grid;
        grid-template-rows: 0.95fr 1.05fr 1.1fr;
        gap: 22px;
        min-height: 0;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(143, 185, 255, 0.18);
        color: var(--muted);
        font-size: 13px;
      }

      .status-chip .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--warn);
        box-shadow: 0 0 20px rgba(255, 210, 130, 0.45);
      }

      .status-chip.pass {
        color: var(--good);
        border-color: rgba(140, 245, 182, 0.35);
      }

      .status-chip.pass .dot {
        background: var(--good);
        box-shadow: 0 0 20px rgba(140, 245, 182, 0.5);
      }

      .status-chip.fail {
        color: var(--bad);
        border-color: rgba(255, 122, 122, 0.35);
      }

      .status-chip.fail .dot {
        background: var(--bad);
        box-shadow: 0 0 20px rgba(255, 122, 122, 0.48);
      }

      .receipt-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        padding: 20px 22px 24px;
      }

      .receipt-grid .cell {
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.028);
        border: 1px solid rgba(143, 185, 255, 0.14);
      }

      .receipt-grid .cell .label {
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .receipt-grid .cell .value {
        font-size: 14px;
        font-weight: 600;
        word-break: break-word;
      }

      .receipt-grid .cell .mono {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }

      .registry-steps {
        list-style: none;
        margin: 0;
        padding: 18px 22px 24px;
        display: grid;
        gap: 12px;
      }

      .registry-step {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(143, 185, 255, 0.14);
        background: rgba(255, 255, 255, 0.024);
        transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
      }

      .registry-step.active {
        transform: translateX(6px);
        border-color: rgba(76, 198, 255, 0.42);
        background: rgba(76, 198, 255, 0.08);
      }

      .registry-step.done {
        border-color: rgba(140, 245, 182, 0.32);
        background: rgba(140, 245, 182, 0.08);
      }

      .registry-step.fail {
        border-color: rgba(255, 122, 122, 0.3);
        background: rgba(255, 122, 122, 0.08);
      }

      .registry-name {
        font-weight: 600;
      }

      .registry-detail {
        font-size: 12px;
        color: var(--muted);
        margin-top: 4px;
      }

      .registry-state {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .hash-section {
        padding: 18px 22px 24px;
      }

      .hash-line {
        margin-bottom: 14px;
      }

      .hash-label {
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }

      .hash-value {
        min-height: 74px;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(143, 185, 255, 0.14);
        background: rgba(255, 255, 255, 0.028);
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 13px;
        word-break: break-all;
        line-height: 1.58;
      }

      .hash-value.hash-diff span.same {
        color: var(--diff-same);
      }

      .hash-value.hash-diff span.change {
        color: var(--diff-change);
        background: rgba(255, 139, 139, 0.1);
        border-radius: 4px;
      }

      .hash-value.hash-diff span.marker {
        color: #ffd282;
      }

      .footer-note {
        position: fixed;
        left: 32px;
        bottom: 20px;
        z-index: 35;
        color: rgba(196, 212, 234, 0.75);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div id="stage">
      <div class="eyebrow">TrustSignal live demonstration</div>
      <div class="title" id="overlay-title">Preparing evidence integrity walkthrough</div>
      <div class="body" id="overlay-body">The browser will narrate each checkpoint as the demonstration advances.</div>
    </div>
    <div id="failure-flash"></div>

    <main class="layout">
      <section class="panel artifact-shell">
        <div class="panel-header">
          <div>
            <div class="panel-title">Artifact content</div>
            <div class="panel-subtitle">Local evidence bundle generated at runtime</div>
          </div>
          <div class="status-chip" id="verification-chip">
            <span class="dot"></span>
            <span id="verification-chip-text">Awaiting scenario</span>
          </div>
        </div>
        <div class="artifact-meta">
          <div>
            <div class="label">Artifact ID</div>
            <div class="value" id="artifact-id">-</div>
          </div>
          <div>
            <div class="label">Parcel</div>
            <div class="value" id="artifact-parcel">-</div>
          </div>
          <div>
            <div class="label">Recorded</div>
            <div class="value" id="artifact-recorded">-</div>
          </div>
          <div>
            <div class="label">Policy</div>
            <div class="value" id="artifact-policy">-</div>
          </div>
        </div>
        <pre id="artifact-content">{}</pre>
      </section>

      <section class="right-column">
        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Receipt metadata</div>
              <div class="panel-subtitle">Integrity receipt and presentation state</div>
            </div>
          </div>
          <div class="receipt-grid">
            <div class="cell">
              <div class="label">Scenario</div>
              <div class="value" id="receipt-scenario">-</div>
            </div>
            <div class="cell">
              <div class="label">Result</div>
              <div class="value" id="receipt-result">-</div>
            </div>
            <div class="cell">
              <div class="label">Receipt ID</div>
              <div class="value mono" id="receipt-id">-</div>
            </div>
            <div class="cell">
              <div class="label">Evidence timestamp</div>
              <div class="value" id="receipt-timestamp">-</div>
            </div>
            <div class="cell">
              <div class="label">Source digest</div>
              <div class="value mono" id="receipt-source-digest">-</div>
            </div>
            <div class="cell">
              <div class="label">Receipt digest</div>
              <div class="value mono" id="receipt-digest">-</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">Registry evidence path</div>
              <div class="panel-subtitle">Deterministic demo steps using local mock lookups</div>
            </div>
          </div>
          <ul class="registry-steps" id="registry-steps"></ul>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <div class="panel-title">SHA-256 evidence comparison</div>
              <div class="panel-subtitle">Original digest, observed digest, and divergence view</div>
            </div>
          </div>
          <div class="hash-section">
            <div class="hash-line">
              <div class="hash-label">Expected digest</div>
              <div class="hash-value" id="expected-hash">-</div>
            </div>
            <div class="hash-line">
              <div class="hash-label">Observed digest</div>
              <div class="hash-value" id="observed-hash">-</div>
            </div>
            <div class="hash-line">
              <div class="hash-label">Hash diff</div>
              <div class="hash-value hash-diff" id="hash-diff">No diff yet.</div>
            </div>
          </div>
        </section>
      </section>
    </main>

    <div class="footer-note">Messaging focus: evidence integrity infrastructure, provenance, and deterministic verification</div>

    <script>
      (() => {
        const state = {
          overlayTitle: document.getElementById('overlay-title'),
          overlayBody: document.getElementById('overlay-body'),
          verificationChip: document.getElementById('verification-chip'),
          verificationChipText: document.getElementById('verification-chip-text'),
          artifactId: document.getElementById('artifact-id'),
          artifactParcel: document.getElementById('artifact-parcel'),
          artifactRecorded: document.getElementById('artifact-recorded'),
          artifactPolicy: document.getElementById('artifact-policy'),
          artifactContent: document.getElementById('artifact-content'),
          receiptScenario: document.getElementById('receipt-scenario'),
          receiptResult: document.getElementById('receipt-result'),
          receiptId: document.getElementById('receipt-id'),
          receiptTimestamp: document.getElementById('receipt-timestamp'),
          receiptSourceDigest: document.getElementById('receipt-source-digest'),
          receiptDigest: document.getElementById('receipt-digest'),
          expectedHash: document.getElementById('expected-hash'),
          observedHash: document.getElementById('observed-hash'),
          hashDiff: document.getElementById('hash-diff'),
          registrySteps: document.getElementById('registry-steps'),
          failureFlash: document.getElementById('failure-flash')
        };

        const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

        function setOverlay(title, body) {
          state.overlayTitle.textContent = title;
          state.overlayBody.textContent = body;
        }

        function setArtifact(artifact) {
          state.artifactId.textContent = artifact.artifactId;
          state.artifactParcel.textContent = artifact.parcelId;
          state.artifactRecorded.textContent = artifact.recordedAt;
          state.artifactPolicy.textContent = artifact.policyProfile;
          state.artifactContent.textContent = JSON.stringify(artifact, null, 2);
        }

        function setReceipt(receipt) {
          state.receiptScenario.textContent = receipt.scenario;
          state.receiptResult.textContent = receipt.status;
          state.receiptId.textContent = receipt.receiptId;
          state.receiptTimestamp.textContent = receipt.timestamp;
          state.receiptSourceDigest.textContent = receipt.sourceDigest;
          state.receiptDigest.textContent = receipt.receiptDigest;
        }

        function setVerification(status, detail) {
          state.verificationChip.className = 'status-chip';
          if (status === 'VERIFIED') {
            state.verificationChip.classList.add('pass');
          } else if (status === 'FAILED') {
            state.verificationChip.classList.add('fail');
          }
          state.verificationChipText.textContent = status === 'PENDING' ? detail : status + ' | ' + detail;
        }

        async function animateHash(element, value, options = {}) {
          const { tick = 14, clearFirst = true } = options;
          if (clearFirst) {
            element.textContent = '';
          }
          for (let index = 0; index < value.length; index += 1) {
            element.textContent += value[index];
            await delay(tick);
          }
        }

        function renderHashDiff(expected, observed) {
          if (!expected || !observed) {
            state.hashDiff.textContent = 'No diff yet.';
            return;
          }

          const pieces = [];
          for (let index = 0; index < expected.length; index += 1) {
            const expectedChar = expected[index];
            const observedChar = observed[index] || '';
            if (expectedChar === observedChar) {
              pieces.push('<span class="same">' + expectedChar + '</span>');
            } else {
              pieces.push('<span class="change">' + observedChar + '</span>');
            }
          }

          if (expected !== observed) {
            pieces.push('<span class="marker">  mismatch</span>');
          }

          state.hashDiff.innerHTML = pieces.join('');
        }

        function renderRegistrySteps(steps) {
          state.registrySteps.innerHTML = '';
          for (const step of steps) {
            const item = document.createElement('li');
            item.className = 'registry-step';

            const copy = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'registry-name';
            title.textContent = step.name;
            const detail = document.createElement('div');
            detail.className = 'registry-detail';
            detail.textContent = step.detail;
            copy.appendChild(title);
            copy.appendChild(detail);

            const status = document.createElement('div');
            status.className = 'registry-state';
            status.textContent = step.status;

            item.appendChild(copy);
            item.appendChild(status);
            state.registrySteps.appendChild(item);
          }
        }

        function updateRegistryState(index, type, label) {
          const node = state.registrySteps.children[index];
          if (!node) {
            return;
          }
          node.classList.remove('active', 'done', 'fail');
          if (type) {
            node.classList.add(type);
          }
          const stateNode = node.querySelector('.registry-state');
          if (stateNode) {
            stateNode.textContent = label;
          }
        }

        function triggerFailureFlash() {
          state.failureFlash.classList.remove('active');
          void state.failureFlash.offsetWidth;
          state.failureFlash.classList.add('active');
        }

        window.demoUi = {
          delay,
          setOverlay,
          setArtifact,
          setReceipt,
          setVerification,
          animateHash,
          renderHashDiff,
          renderRegistrySteps,
          updateRegistryState,
          triggerFailureFlash
        };
      })();
    </script>
  </body>
</html>`;
}

function createRuntimeServer(runtimeDir, html) {
  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }

    if (request.url === '/' || request.url === `/${HTML_FILE_NAME}`) {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
      return;
    }

    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve local server address.'));
        return;
      }
      const url = `http://127.0.0.1:${address.port}/${HTML_FILE_NAME}`;
      const htmlPath = path.join(runtimeDir, HTML_FILE_NAME);
      fs.writeFileSync(htmlPath, html, 'utf8');
      resolve({ server, url, htmlPath });
    });
  });
}

async function withBrowser() {
  return chromium.launch({
    headless: false,
    slowMo: 40
  });
}

async function waitForUi(page) {
  await page.waitForFunction(() => Boolean(window.demoUi), { timeout: 10_000 });
}

function buildRegistrySteps() {
  return [
    {
      name: 'Registry intake',
      detail: 'Presentation package registered in local evidence queue.',
      status: 'Queued'
    },
    {
      name: 'Recorder index lookup',
      detail: 'Mock county recorder index returns the expected document number.',
      status: 'Queued'
    },
    {
      name: 'Chain-of-custody checkpoint',
      detail: 'Source digest is compared with the receipt baseline.',
      status: 'Queued'
    },
    {
      name: 'Evidence state decision',
      detail: 'Verification status is issued for presentation.',
      status: 'Queued'
    }
  ];
}

function buildReceipt({ scenarioName, artifactHash, status, tampered }) {
  const issuedAt = new Date();
  const receiptSeed = `${scenarioName}|${artifactHash}|${status}|${issuedAt.toISOString()}`;
  const receiptDigest = sha256Hex(`receipt|${receiptSeed}`);
  return {
    scenario: scenarioName,
    status,
    receiptId: `rcpt_${receiptDigest.slice(0, 16)}`,
    timestamp: formatUtc(issuedAt),
    sourceDigest: artifactHash,
    receiptDigest,
    tampered
  };
}

function readArtifact(artifactPath) {
  const contents = fs.readFileSync(artifactPath, 'utf8');
  return {
    contents,
    parsed: JSON.parse(contents),
    hash: sha256Hex(contents)
  };
}

async function runProgressPhase(progress, label, steps) {
  for (let index = 0; index < steps.length; index += 1) {
    await progress(label, steps, index);
  }
}

async function setOverlay(page, title, body) {
  await page.evaluate(
    ({ nextTitle, nextBody }) => {
      window.demoUi.setOverlay(nextTitle, nextBody);
    },
    { nextTitle: title, nextBody: body }
  );
}

async function renderArtifact(page, artifact) {
  await page.evaluate((payload) => {
    window.demoUi.setArtifact(payload);
  }, artifact);
}

async function renderReceipt(page, receipt) {
  await page.evaluate((payload) => {
    window.demoUi.setReceipt(payload);
  }, receipt);
}

async function renderRegistrySteps(page, steps) {
  await page.evaluate((payload) => {
    window.demoUi.renderRegistrySteps(payload);
  }, steps);
}

async function advanceRegistrySteps(page, decisionType) {
  for (let index = 0; index < 4; index += 1) {
    await page.evaluate((stepIndex) => {
      window.demoUi.updateRegistryState(stepIndex, 'active', 'Running');
    }, index);
    await sleep(REGISTRY_DELAY_MS);
    const lastStep = index === 3;
    const type = lastStep && decisionType === 'fail' ? 'fail' : 'done';
    const label = lastStep && decisionType === 'fail' ? 'Failed' : 'Completed';
    await page.evaluate(
      ({ stepIndex, nextType, nextLabel }) => {
        window.demoUi.updateRegistryState(stepIndex, nextType, nextLabel);
      },
      { stepIndex: index, nextType: type, nextLabel: label }
    );
  }
}

async function animateHashes(page, expectedHash, observedHash) {
  await page.evaluate(
    async ({ expected, observed, tick }) => {
      await window.demoUi.animateHash(document.getElementById('expected-hash'), expected, { tick, clearFirst: true });
      await window.demoUi.animateHash(document.getElementById('observed-hash'), observed, { tick, clearFirst: true });
      window.demoUi.renderHashDiff(expected, observed);
    },
    { expected: expectedHash, observed: observedHash, tick: HASH_TICK_MS }
  );
}

async function updateVerificationState(page, status, detail) {
  await page.evaluate(
    ({ nextStatus, nextDetail }) => {
      window.demoUi.setVerification(nextStatus, nextDetail);
    },
    { nextStatus: status, nextDetail: detail }
  );
}

async function triggerFailureFlash(page) {
  await page.evaluate(() => {
    window.demoUi.triggerFailureFlash();
  });
}

function buildTamperedArtifact(originalArtifact) {
  return {
    ...originalArtifact,
    grantee: 'Acme Title Holdings LLC',
    evidence: {
      ...originalArtifact.evidence,
      pageCount: 13,
      sourceRecord: 'County recorder export (tampered local copy)'
    },
    tamperNote: 'Demonstration-only mutation to show failed integrity verification.'
  };
}

async function runScenario({
  page,
  progress,
  artifactPath,
  expectedHash,
  scenarioName,
  tamperExpected
}) {
  const artifactState = readArtifact(artifactPath);
  const receipt = buildReceipt({
    scenarioName,
    artifactHash: artifactState.hash,
    status: tamperExpected ? 'FAILED' : 'VERIFIED',
    tampered: tamperExpected
  });

  await renderArtifact(page, artifactState.parsed);
  await renderReceipt(page, receipt);
  await renderRegistrySteps(page, buildRegistrySteps());

  const progressSteps = [
    'Load artifact from local evidence workspace',
    'Replay deterministic registry lookups',
    'Animate SHA-256 digest comparison',
    'Issue presentation receipt'
  ];

  await runProgressPhase(progress, scenarioName, progressSteps);
  await setOverlay(
    page,
    scenarioName,
    tamperExpected
      ? 'The observed file differs from the recorded baseline, so the evidence chain cannot be trusted.'
      : 'The observed file matches the recorded baseline, so the evidence chain remains intact.'
  );
  await sleep(OVERLAY_PAUSE_MS);

  await updateVerificationState(page, 'PENDING', 'Running deterministic integrity checks');
  await advanceRegistrySteps(page, tamperExpected ? 'fail' : 'pass');
  await animateHashes(page, expectedHash, artifactState.hash);

  if (tamperExpected) {
    await triggerFailureFlash(page);
    await updateVerificationState(page, 'FAILED', 'Observed digest diverged from the baseline');
  } else {
    await updateVerificationState(page, 'VERIFIED', 'Source digest matches the issued receipt');
  }

  await sleep(SCENARIO_PAUSE_MS);

  const uiState = await page.evaluate(() => ({
    overlayTitle: document.getElementById('overlay-title').textContent,
    verificationText: document.getElementById('verification-chip-text').textContent,
    receiptResult: document.getElementById('receipt-result').textContent
  }));

  return {
    expectedHash,
    observedHash: artifactState.hash,
    receipt,
    uiState
  };
}

async function main() {
  const runtimeRoot = ensureDir(path.join(process.cwd(), 'output', 'playwright', 'trustsignal-demo'));
  const runtimeDir = fs.mkdtempSync(path.join(runtimeRoot, `run-${Date.now()}-`));
  const artifactPath = path.join(runtimeDir, ARTIFACT_FILE_NAME);

  const initialArtifact = buildArtifactPayload();
  fs.writeFileSync(artifactPath, JSON.stringify(initialArtifact, null, 2), 'utf8');

  const baselineArtifact = readArtifact(artifactPath);
  const html = createRuntimeHtml();
  const { server, url, htmlPath } = await createRuntimeServer(runtimeDir, html);

  const progress = createProgressPrinter();
  let browser;
  let context;

  const summary = {
    runtimeDir,
    htmlPath,
    artifactPath,
    baselineHash: baselineArtifact.hash,
    scenario1: null,
    scenario2: null
  };

  console.log(`Runtime HTML: ${htmlPath}`);
  console.log(`Artifact path: ${artifactPath}`);
  console.log(`Local server: ${url}`);

  try {
    browser = await withBrowser();
    context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    browser.on('disconnected', () => {
      console.error('\n[demo] browser disconnected unexpectedly');
    });
    page.on('close', () => {
      console.error('\n[demo] page closed');
    });
    page.on('crash', () => {
      console.error('\n[demo] page crashed');
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await waitForUi(page);

    await setOverlay(
      page,
      'Evidence integrity infrastructure',
      'TrustSignal demonstrates whether a presented artifact still matches the recorded evidence baseline.'
    );
    await sleep(OVERLAY_PAUSE_MS);

    summary.scenario1 = await runScenario({
      page,
      progress,
      artifactPath,
      expectedHash: baselineArtifact.hash,
      scenarioName: 'Scenario 1: Baseline evidence path',
      tamperExpected: false
    });

    const tamperedArtifact = buildTamperedArtifact(initialArtifact);
    fs.writeFileSync(artifactPath, JSON.stringify(tamperedArtifact, null, 2), 'utf8');

    await setOverlay(
      page,
      'Tamper event introduced',
      'The local artifact file is modified between presentation steps to simulate an integrity break.'
    );
    await sleep(OVERLAY_PAUSE_MS);

    summary.scenario2 = await runScenario({
      page,
      progress,
      artifactPath,
      expectedHash: baselineArtifact.hash,
      scenarioName: 'Scenario 2: Tampered evidence path',
      tamperExpected: true
    });

    await setOverlay(
      page,
      'Demonstration complete',
      'Scenario 1 remained VERIFIED. Scenario 2 failed after the file changed. The browser will close automatically.'
    );
    await sleep(1800);

    const reportPath = path.join(runtimeDir, 'demo-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`\nDemo report: ${reportPath}`);
    console.log(`Scenario 1 status: ${summary.scenario1.receipt.status}`);
    console.log(`Scenario 2 status: ${summary.scenario2.receipt.status}`);
  } finally {
    await Promise.allSettled([
      context ? context.close() : Promise.resolve(),
      browser ? browser.close() : Promise.resolve()
    ]);
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error('\nTrustSignal demo failed.');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
