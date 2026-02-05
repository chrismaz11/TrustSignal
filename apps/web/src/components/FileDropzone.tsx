'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { createWorker } from 'tesseract.js';
import { computeFileHash } from '../utils/hashing';
import { extractMetadataFromText, cleanPdfText } from '../utils/extraction';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type VerificationReport = {
    summary: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
    checks: Array<{ id: string; status: string; message: string }>;
    evidence: { matchConfidence: number; endpointUsed?: string; reason?: string };
} | null;

// Polyfill Promise.withResolvers
declare global {
    interface PromiseConstructor {
        withResolvers<T>(): {
            promise: Promise<T>;
            resolve: (value: T | PromiseLike<T>) => void;
            reject: (reason?: any) => void;
        };
    }
}

if (typeof Promise.withResolvers === 'undefined') {
    // @ts-ignore - Polyfill for missing type definition
    Promise.withResolvers = function <T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: any) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

export function FileDropzone() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [hash, setHash] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'ready'>('idle');
    const [metadata, setMetadata] = useState<{ parcelId: string; grantor: string; text: string }>({ parcelId: '', grantor: '', text: '' });
    const [report, setReport] = useState<VerificationReport>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selected = acceptedFiles[0];
        if (!selected) return;

        setFile(selected);
        setStatus('processing');
        setError(null);
        setReport(null);
        setMetadata({ parcelId: '', grantor: '', text: '' });

        // 1. Compute Security Hash
        const computedHash = await computeFileHash(selected);
        setHash(computedHash);

        // 2. Perform Client-Side Extraction (with resilient worker paths)
        let text = '';

        // Prefer the non-SIMD core to avoid COOP/COEP requirements in Next.js
        const workerOptions = {
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js',
            corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v7.0.0/tesseract-core.wasm.js',
            langPath: 'https://tessdata.projectnaptha.com/4.0.0'
        } as const;


        const runOcr = async (input: ImageBitmapSource | string | HTMLCanvasElement | Blob) => {
            const worker = await createWorker('eng', undefined, workerOptions);
            const ret = await worker.recognize(input as any);
            await worker.terminate();
            return ret.data.text;
        };

        if (selected.type.startsWith('image/')) {
            try {
                text = await runOcr(selected);
            } catch (err) {
                console.error('OCR Failed', err);
            }
        } else if (selected.type === 'application/pdf') {
            try {
                const arrayBuffer = await selected.arrayBuffer();

                // Dynamically import pdfjs-dist and disable the worker to avoid cross-origin issues
                // @ts-ignore - dynamic import types are tricky
                const { getDocument, GlobalWorkerOptions, version } = await import('pdfjs-dist/build/pdf');
                GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

                const pdf = await getDocument({
                    data: arrayBuffer,
                    disableWorker: true, // keep everything in-page to avoid cross-origin worker errors
                    useWorkerFetch: false,
                    isEvalSupported: false
                }).promise;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    const strings = content.items.map((item: any) => item.str);

                    // Filter out common watermark/noise phrases to avoid pollution
                    const pageText = cleanPdfText(strings.join(' '));

                    text += pageText + ' ';
                }

                // 2. Fallback to OCR if text is empty (Scanned PDF)
                if (text.trim().length < 50) {
                    console.log('PDF text empty or sparse, switching to OCR for Scanned PDF...');

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');

                        if (context) {
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport }).promise;
                            text += await runOcr(canvas) + ' ';
                        }
                    }
                }
            } catch (err) {
                console.error('PDF Extraction Failed', err);
            }
        }


        // Extraction helpers
        const { parcelId, grantor } = extractMetadataFromText(text);

        setMetadata({
            parcelId: parcelId,
            grantor: grantor,
            text
        });

        // Move to review stage instead of auto-verifying
        setStatus('review');
    }, []);

    const runVerification = async () => {
        if (!metadata) return;
        setStatus('processing');

        // Extract address from text if possible for payload
        const addressRegex = /(\d{3,6}\s+[A-Za-z0-9'.,\s]+?),\s*([A-Za-z\s]+?),\s*(IL|Illinois)\s+(\d{5})(?:-\d{4})?/i;
        const addressMatch = metadata.text.match(addressRegex);
        const address = addressMatch && addressMatch.length >= 5
            ? {
                line1: addressMatch[1].replace(/\s+/g, ' ').trim(),
                city: addressMatch[2].replace(/\s+/g, ' ').trim(),
                state: 'IL',
                zip: addressMatch[4]
            }
            : null;

        try {
            const payload = {
                jurisdiction: { state: 'IL', county: 'Cook' },
                pin: metadata.parcelId || null,
                address,
                legalDescriptionText: metadata.text || null,
                grantors: metadata.grantor ? [metadata.grantor] : [],
                grantees: [],
                executionDate: null,
                recording: { docNumber: null, recordingDate: null },
                notary: null
            };

            const res = await fetch(`${API_BASE}/api/v1/verify/attom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Verification failed (${res.status})`);
            }

            const data = await res.json();
            setReport(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Verification failed');
        }
        setStatus('ready');
    };


    const proceedToVerification = () => {
        if (!metadata || !hash) return;
        const params = new URLSearchParams();
        if (metadata.parcelId) params.set('pin', metadata.parcelId);
        if (metadata.grantor) params.set('grantor', metadata.grantor);
        params.set('hash', hash);

        router.push(`/verify?${params.toString()}`);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/bmp': ['.bmp'],
            'image/tiff': ['.tif', '.tiff'],
            'application/pdf': ['.pdf']
        }
    });

    return (
        <div className="p-6 border-2 border-dashed border-gray-600 rounded-xl bg-gray-900/50 text-center">
            <div {...getRootProps()} className="cursor-pointer py-12">
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p className="text-orange-400 font-bold">Drop the deed file here...</p>
                ) : (
                    <p className="text-gray-300">Drag & drop a PDF/Image deed to Auto-Fill</p>
                )}
            </div>

            {status === 'processing' && (
                <div className="mt-4 text-orange-400 animate-pulse">
                    ⚙️ Processing...
                </div>
            )}

            {(status === 'review' || status === 'ready') && file && hash && (
                <div className="mt-6 text-left bg-black/40 p-4 rounded-lg border border-gray-700">
                    <h4 className="text-white font-semibold mb-2">Review & Verify</h4>
                    <p className="text-xs text-gray-400 mb-4">Please confirm extracted data before verifying.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="bg-gray-800 p-2 rounded">
                            <label className="text-gray-400 block text-xs mb-1">Parcel ID (PIN)</label>
                            <input
                                className="w-full bg-gray-900 text-white font-mono p-1 rounded border border-gray-700 focus:border-orange-500 outline-none"
                                value={metadata.parcelId}
                                onChange={(e) => setMetadata({ ...metadata, parcelId: e.target.value })}
                                placeholder="12-34-567-890-0000"
                            />
                        </div>
                        <div className="bg-gray-800 p-2 rounded">
                            <label className="text-gray-400 block text-xs mb-1">Grantor Name</label>
                            <input
                                className="w-full bg-gray-900 text-white font-mono p-1 rounded border border-gray-700 focus:border-orange-500 outline-none"
                                value={metadata.grantor}
                                onChange={(e) => setMetadata({ ...metadata, grantor: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>
                    </div>

                    {status === 'review' && (
                        <button
                            onClick={runVerification}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Verify Compliance Now
                        </button>
                    )}

                    {status === 'ready' && (
                        <>
                            <p className="text-sm text-gray-400 mt-4 mb-2">
                                Hash: <span className="font-mono text-xs text-green-400 break-all">{hash}</span>
                            </p>
                            {error && (
                                <p className="text-sm text-red-400 mt-2">Verification error: {error}</p>
                            )}
                            {report && (
                                <div className="mt-3 text-sm text-gray-200">
                                    <div className="font-semibold">ATTOM Cross-Check: {report.summary}</div>
                                    <div className="text-xs text-gray-400">Confidence: {Math.round((report.evidence.matchConfidence || 0) * 100)}%</div>
                                    <ul className="mt-2 space-y-1">
                                        {report.checks.slice(0, 6).map((c) => (
                                            <li key={c.id} className="flex items-start gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'PASS' ? 'bg-green-800/60' : c.status === 'WARN' ? 'bg-yellow-800/60' : c.status === 'FAIL' ? 'bg-red-800/60' : 'bg-gray-700/60'}`}>
                                                    {c.status}
                                                </span>
                                                <span className="text-gray-300">{c.message}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={runVerification}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded text-xs"
                                >
                                    Re-verify
                                </button>
                                <button
                                    onClick={proceedToVerification}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded text-xs"
                                >
                                    Proceed to Recording
                                </button>
                            </div>
                        </>
                    )}

                    <div className="mt-4 p-2 bg-blue-900/20 text-blue-200 text-xs rounded border border-blue-800">
                        🔒 Privacy Active: Metadata and extracted text are ephemeral and not stored.
                    </div>
                </div>
            )}
        </div>
    );
}
