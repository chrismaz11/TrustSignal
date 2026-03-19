'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type ReceiptLike = {
  version?: string;
  mode?: string;
  artifactHash?: string;
  timestamp?: string;
  source?: unknown;
  [key: string]: unknown;
};

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', input);
  return bytesToHex(digest);
}

function extractReceiptFingerprint(receipt: unknown) {
  const obj = receipt as { artifactHash?: unknown; sha256?: unknown; artifact?: { hash?: unknown } } | null;
  const raw =
    (typeof obj?.artifactHash === 'string' && obj.artifactHash) ||
    (typeof obj?.sha256 === 'string' && obj.sha256) ||
    (typeof obj?.artifact?.hash === 'string' && obj.artifact.hash) ||
    '';

  const normalized = raw.trim().toLowerCase().replace(/^sha256:/, '');
  if (!/^[a-f0-9]{64}$/.test(normalized)) return null;
  return normalized;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type VerifyState = null | 'success' | 'failure';

export default function ArtifactVerifyClient() {
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [artifactFingerprint, setArtifactFingerprint] = useState<string | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  const [, setReceipt] = useState<ReceiptLike | null>(null);
  const [receiptFingerprint, setReceiptFingerprint] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [verifyState, setVerifyState] = useState<VerifyState>(null);

  const resetResult = () => setVerifyState(null);

  const onPickArtifact = useCallback(async (file: File) => {
    setArtifactError(null);
    setArtifactFile(file);
    setArtifactFingerprint(null);
    resetResult();
    try {
      const buffer = await file.arrayBuffer();
      const fp = await sha256Hex(buffer);
      setArtifactFingerprint(fp);
    } catch {
      setArtifactError('Could not read that file. Try again.');
    }
  }, []);

  const onDropReceipt = useCallback(async (files: File[]) => {
    resetResult();
    setReceiptError(null);
    const file = files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ReceiptLike;
      const fp = extractReceiptFingerprint(parsed);
      if (!fp) {
        setReceiptError('That receipt file does not look like a TrustSignal receipt (missing fingerprint).');
        return;
      }
      setReceipt(parsed);
      setReceiptFingerprint(fp);
    } catch {
      setReceiptError('Could not read that receipt file. Make sure it is a JSON file.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropReceipt,
    multiple: false,
    accept: { 'application/json': ['.json'] }
  });

  const canGenerateReceipt = Boolean(artifactFile && artifactFingerprint);
  const canVerify = Boolean(artifactFingerprint && receiptFingerprint);

  const generateReceipt = useCallback(() => {
    resetResult();
    setReceiptError(null);
    if (!artifactFile || !artifactFingerprint) {
      setReceiptError('Upload an artifact first.');
      return;
    }

    const receiptData: ReceiptLike = {
      version: '1.0',
      mode: 'local',
      artifactHash: artifactFingerprint,
      timestamp: new Date().toISOString(),
      source: {
        provider: 'trustsignal-web',
        artifactName: artifactFile.name,
        artifactSizeBytes: artifactFile.size
      }
    };

    setReceipt(receiptData);
    setReceiptFingerprint(artifactFingerprint);
    downloadJson('trustsignal-receipt.json', receiptData);
  }, [artifactFile, artifactFingerprint]);

  const verify = useCallback(() => {
    setVerifyState(null);
    if (!artifactFingerprint || !receiptFingerprint) return;
    setVerifyState(artifactFingerprint === receiptFingerprint ? 'success' : 'failure');
  }, [artifactFingerprint, receiptFingerprint]);

  const artifactSummary = useMemo(() => {
    if (!artifactFile) return 'No file selected yet.';
    return `${artifactFile.name} (${artifactFile.size.toLocaleString()} bytes)`;
  }, [artifactFile]);

  return (
    <div className="card">
      <h2>Verify an Artifact</h2>
      <p className="muted">
        This runs locally in your browser. It does not upload your file anywhere. It creates an unsigned local receipt
        you can keep and use later to check whether the file changed.
      </p>
      <p className="muted">Use the TrustSignal API when you need a signed receipt that is stored and verified server-side.</p>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <section className="card" style={{ padding: 16 }}>
          <h3>Step 1 — Upload Artifact</h3>
          <p className="muted">Pick the file you want to protect from unexpected changes.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="button"
              type="button"
              onClick={() => document.getElementById('trustsignal-artifact-input')?.click()}
            >
              Upload Artifact
            </button>
            <span className="muted">{artifactSummary}</span>
          </div>
          <input
            id="trustsignal-artifact-input"
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickArtifact(file);
            }}
          />
          {artifactFingerprint && <p className="muted">Fingerprint ready.</p>}
          {artifactError && <p className="muted">{artifactError}</p>}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3>Step 2 — Generate or Load Receipt</h3>
          <p className="muted">
            A local receipt is a small JSON file that stores the artifact’s fingerprint. Save it somewhere safe.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="button" type="button" onClick={generateReceipt} disabled={!canGenerateReceipt}>
              Generate Receipt
            </button>
            <div
              {...getRootProps()}
              style={{
                border: '1px dashed rgba(255,255,255,0.25)',
                padding: '10px 12px',
                borderRadius: 12,
                minWidth: 260
              }}
            >
              <input {...getInputProps()} />
              <span className="muted">
                {isDragActive ? 'Drop your receipt JSON here…' : 'Or drag & drop an existing receipt JSON here'}
              </span>
            </div>
          </div>
          {receiptFingerprint && <p className="muted">Receipt loaded.</p>}
          {receiptError && <p className="muted">{receiptError}</p>}
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3>Step 3 — Verify Integrity</h3>
          <p className="muted">
            TrustSignal compares the artifact you uploaded with the local receipt you generated earlier.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="button" type="button" onClick={verify} disabled={!canVerify}>
              Verify Integrity
            </button>
            {!canVerify && <span className="muted">Upload an artifact and generate/load a receipt first.</span>}
          </div>

          {verifyState === 'success' && (
            <div style={{ marginTop: 12 }}>
              <p>
                ✔ Artifact matches receipt
                <br />
                Integrity verified
              </p>
            </div>
          )}

          {verifyState === 'failure' && (
            <div style={{ marginTop: 12 }}>
              <p>
                ✖ Artifact drift detected
                <br />
                File no longer matches original receipt
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
