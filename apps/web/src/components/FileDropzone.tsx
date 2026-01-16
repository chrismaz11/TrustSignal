'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { createWorker } from 'tesseract.js';
import { computeFileHash } from '../utils/hashing';

export function FileDropzone() {
    const [file, setFile] = useState<File | null>(null);
    const [hash, setHash] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'ready'>('idle');
    const [metadata, setMetadata] = useState<{ parcelId?: string; grantor?: string } | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const selected = acceptedFiles[0];
        if (!selected) return;

        setFile(selected);
        setStatus('processing');

        // 1. Compute Security Hash
        const computedHash = await computeFileHash(selected);
        setHash(computedHash);

        // 2. Perform Client-Side OCR
        try {
            const worker = await createWorker('eng');
            const ret = await worker.recognize(selected);
            const text = ret.data.text;
            await worker.terminate();

            // Simple Regex Extraction (Demo)
            const parcelMatch = text.match(/(?:Parcel|APN|Tax)?\s*ID\s*[:#]\s*([A-Z0-9-]+)/i);
            const grantorMatch = text.match(/Grantor[:\s]+([A-Z\s,]+)/i);

            setMetadata({
                parcelId: parcelMatch ? parcelMatch[1] : 'NOT FOUND',
                grantor: grantorMatch ? grantorMatch[1].trim() : 'NOT FOUND'
            });
        } catch (err) {
            console.error('OCR Failed', err);
        }

        setStatus('ready');
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

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
                    ⚙️ Hashing & OCR Scanning...
                </div>
            )}

            {status === 'ready' && file && hash && (
                <div className="mt-6 text-left bg-black/40 p-4 rounded-lg border border-gray-700">
                    <h4 className="text-white font-semibold mb-2">Ready for Verification</h4>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div className="bg-gray-800 p-2 rounded">
                            <span className="text-gray-400 block text-xs">Parcel ID (Auto-Filled)</span>
                            <span className="text-white font-mono">{metadata?.parcelId || '...'}</span>
                        </div>
                        <div className="bg-gray-800 p-2 rounded">
                            <span className="text-gray-400 block text-xs">Grantor (Auto-Filled)</span>
                            <span className="text-white font-mono">{metadata?.grantor || '...'}</span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-400">
                        Hash: <span className="font-mono text-xs text-green-400 break-all">{hash}</span>
                    </p>
                    <div className="mt-4 p-2 bg-blue-900/20 text-blue-200 text-xs rounded border border-blue-800">
                        🔒 Privacy Active: Only this hash is sent to the server. The file remains on your device.
                    </div>
                </div>
            )}
        </div>
    );
}
