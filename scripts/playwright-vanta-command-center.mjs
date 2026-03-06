#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const outDir = process.env.PLAYWRIGHT_OUT_DIR || path.join(process.cwd(), 'output', 'playwright');
const baseUrl = process.env.TRUSTSIGNAL_BASE_URL || 'http://127.0.0.1:3001';
const apiKey = process.env.TRUSTSIGNAL_API_KEY || '';
const bundleId = process.env.TS_BUNDLE_ID || `vanta-demo-${Date.now()}`;
const profile = process.env.TS_POLICY_PROFILE || 'STANDARD_IL';
const headless = (process.env.PLAYWRIGHT_HEADLESS || 'true').toLowerCase() !== 'false';
const recordVideo = (process.env.PLAYWRIGHT_RECORD_VIDEO || 'true').toLowerCase() !== 'false';

const localDemoPath = path.join(process.cwd(), 'apps', 'api', 'public', 'demo', 'vanta-partner-demo.html');
const demoUrl = process.env.PLAYWRIGHT_DEMO_URL || pathToFileURL(localDemoPath).href;

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.error('Missing dependency: playwright');
    console.error('Install it with: npm i -D playwright');
    console.error('Then install browser once with: npx playwright install chromium');
    process.exit(1);
  }
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function isFailureSummary(text) {
  return text.includes('Verify failed') || text.includes('Request failed');
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function runApiFallback(base, key, selectedBundleId, selectedProfile) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': key
  };

  const syntheticRes = await fetch(`${base}/api/v1/synthetic`, {
    method: 'GET',
    headers: { 'x-api-key': key }
  });
  const syntheticBody = await safeJson(syntheticRes);
  if (!syntheticRes.ok) {
    return {
      ok: false,
      summaryText: `Verify failed (${syntheticRes.status})`,
      outputText: JSON.stringify({ stage: 'synthetic', status: syntheticRes.status, body: syntheticBody }, null, 2)
    };
  }

  const body = {
    ...syntheticBody,
    bundleId: selectedBundleId,
    policy: { profile: selectedProfile }
  };

  const verifyRes = await fetch(`${base}/api/v1/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const verifyBody = await safeJson(verifyRes);
  if (!verifyRes.ok) {
    return {
      ok: false,
      summaryText: `Verify failed (${verifyRes.status})`,
      outputText: JSON.stringify({ stage: 'verify', status: verifyRes.status, body: verifyBody }, null, 2)
    };
  }

  const receiptId = verifyBody?.receiptId;
  if (!receiptId) {
    return {
      ok: false,
      summaryText: 'Verify failed (missing receiptId)',
      outputText: JSON.stringify({ stage: 'verify', body: verifyBody }, null, 2)
    };
  }

  const vantaRes = await fetch(`${base}/api/v1/integrations/vanta/verification/${receiptId}`, {
    method: 'GET',
    headers: { 'x-api-key': key }
  });
  const vantaBody = await safeJson(vantaRes);
  if (!vantaRes.ok) {
    return {
      ok: false,
      summaryText: `Status fetch failed (${vantaRes.status})`,
      outputText: JSON.stringify({ stage: 'vanta-status', status: vantaRes.status, body: vantaBody }, null, 2)
    };
  }

  const normalizedStatus = vantaBody?.result?.normalizedStatus || 'UNKNOWN';
  return {
    ok: true,
    summaryText: `Status: ${normalizedStatus} | Receipt: ${receiptId}`,
    outputText: JSON.stringify({ verify: verifyBody, vanta: vantaBody }, null, 2)
  };
}

async function run() {
  if (!fs.existsSync(localDemoPath) && !process.env.PLAYWRIGHT_DEMO_URL) {
    console.error(`Demo page not found at ${localDemoPath}`);
    console.error('Set PLAYWRIGHT_DEMO_URL to an alternate page URL.');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless });
  const videoDir = path.join(outDir, 'videos');
  if (recordVideo) fs.mkdirSync(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: recordVideo
      ? {
          dir: videoDir,
          size: { width: 1280, height: 720 }
        }
      : undefined
  });
  const page = await context.newPage();
  const pageVideo = recordVideo ? page.video() : null;

  const startedAt = new Date().toISOString();
  const stamp = nowStamp();
  const screenshotPath = path.join(outDir, `vanta-command-center-${stamp}.png`);
  const resultPath = path.join(outDir, `vanta-command-center-${stamp}.json`);
  const finalVideoPath = recordVideo ? path.join(videoDir, `vanta-command-center-${stamp}.webm`) : null;

  try {
    await page.goto(demoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.fill('#baseUrl', baseUrl);
    await page.fill('#apiKey', apiKey);
    await page.fill('#bundleId', bundleId);
    await page.selectOption('#profile', profile);

    await page.click('#run');

    await page.waitForFunction(
      () => {
        const out = document.querySelector('#output');
        return Boolean(out && out.textContent && out.textContent.trim() !== 'No run yet.');
      },
      { timeout: 45000 }
    );

    let summaryText = (await page.textContent('#summary'))?.trim() || '';
    let outputText = (await page.textContent('#output'))?.trim() || '';

    // Local file:// demo pages can fail cross-origin fetch with "TypeError: Failed to fetch".
    // Fallback performs the same API flow from Node context and reflects results back into the page.
    if (summaryText === 'Request failed' && outputText.includes('TypeError: Failed to fetch')) {
      const fallback = await runApiFallback(baseUrl, apiKey, bundleId, profile);
      summaryText = fallback.summaryText;
      outputText = fallback.outputText;

      await page.evaluate(
        ({ nextSummary, nextOutput }) => {
          const summaryEl = document.getElementById('summary');
          const outputEl = document.getElementById('output');
          if (summaryEl) summaryEl.textContent = nextSummary;
          if (outputEl) outputEl.textContent = nextOutput;
        },
        { nextSummary: summaryText, nextOutput: outputText }
      );
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });

    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      demoUrl,
      baseUrl,
      bundleId,
      profile,
      summaryText,
      outputText,
      screenshotPath,
      videoPath: finalVideoPath,
      ok: summaryText.includes('Status:') && !isFailureSummary(summaryText)
    };
    fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));

    console.log(`Playwright run complete. Report: ${resultPath}`);
    console.log(`Screenshot: ${screenshotPath}`);
    if (finalVideoPath) console.log(`Video: ${finalVideoPath}`);
    console.log(`Summary: ${summaryText || '<empty>'}`);

    if (!report.ok) {
      console.error('Demo run did not produce a successful status.');
      process.exitCode = 2;
    }
  } finally {
    await context.close();
    if (pageVideo && finalVideoPath) {
      try {
        const tempVideoPath = await pageVideo.path();
        if (tempVideoPath && tempVideoPath !== finalVideoPath) {
          fs.renameSync(tempVideoPath, finalVideoPath);
        }
      } catch {
        // no-op: if video is unavailable we keep run artifacts from report/screenshot
      }
    }
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Playwright command-center run failed.');
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
