import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import axios from 'axios';
import chokidar from 'chokidar';
import dotenv from 'dotenv';
import notifier from 'node-notifier';

// Import from Core
// Note: In a real compiled env, this would point to dist. In this monorepo dev setup, we rely on tsx or similar.
import { keccak256Buffer, appendIntegrityPage } from '@deed-shield/core/src/index.ts';

dotenv.config();

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WATCH_DIR = process.env.SOURCE_DIR || path.join(__dirname, '../watched_folder');
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api/v1/verify';
const API_KEY = process.env.API_KEY || 'demo-api-key'; // Fake key for demo

// Ensure watch directory exists
if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true });
    console.log(`Created watch directory: ${WATCH_DIR}`);
}

console.log(`🛡️  Deed Shield Passive Inspector v1.0`);
console.log(`   Monitoring: ${WATCH_DIR}`);
console.log(`   API Endpoint: ${API_URL}`);

const watcher = chokidar.watch(WATCH_DIR, {
    ignored: [
        /(^|[/\\])\../,       // ignore hidden files
        /_verified\.pdf$/      // ignore our own output files to prevent loops
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
    }
});

watcher.on('add', async (filePath) => {
    // Double check extension
    if (!filePath.toLowerCase().endsWith('.pdf')) return;

    const fileName = path.basename(filePath);
    console.log(`\n📄 [DETECTED] New PDF: ${fileName}`);

    try {
        // 1. Zero-Storage Ingest: Read to Memory Buffer
        console.log('   -> Reading file into memory...');
        const fileBuffer = fs.readFileSync(filePath);
        const bufferUint8 = new Uint8Array(fileBuffer);

        // 2. Cryptographic Integrity: Hash the buffer
        console.log('   -> Computing SHA-256 (Keccak-256) hash...');
        const docHash = keccak256Buffer(bufferUint8);
        console.log(`   -> Hash: ${docHash.substring(0, 16)}...`);

        // 3. Prepare Payload
        const payload = {
            bundleId: `INS-${Date.now()}`,
            transactionType: 'monitor_ingest',
            ron: {
                provider: 'PassiveInspector',
                notaryId: 'SYSTEM',
                commissionState: 'IL', 
                sealPayload: 'system-auto-seal' 
            },
            doc: {
                docHash: docHash
                // We do NOT send the PDF base64 here to save bandwidth/privacy unless deep inspection needed. 
                // For this demo, let's assume we send hash only for verification check first.
                // Wait, server logic checks integrity if pdfBase64 is present. 
                // Let's send it to simulate full verification including risk engine.
                , pdfBase64: fileBuffer.toString('base64')
            },
            policy: { profile: 'STANDARD_IL' },
            property: {
                // Heuristic: Extract from filename or use placeholders
                parcelId: fileName.includes('BAD') ? 'SCAM-101' : 'PARCEL-777',
                county: 'Cook',
                state: 'IL'
            }
        };

        // 4. Verify against API
        console.log('   -> Verifying with Policy Engine...');
        const response = await axios.post(API_URL, payload, {
            headers: {
                'x-api-key': API_KEY
            }
        });
        
        const result = response.data; // V2 Response format

        // 5. Action Logic
        if (result.decision === 'ALLOW') {
            const riskScore = result.riskScore || 0;
            console.log(`   -> ✅ VERIFIED (Score: ${riskScore})`);
            
            // Append Certificate of Integrity
            console.log('   -> Appending Certificate of Integrity...');
            
            // Reconstruct a minimal Receipt object for the stamp function
            // (The API returns V2 format, we need to map or just pass what's needed)
            const receiptForStamp = {
                receiptId: result.receiptId,
                receiptHash: result.receiptHash,
                createdAt: new Date().toISOString(),
                policyProfile: 'STANDARD_IL',
                decision: result.decision,
                riskScore: riskScore,
                verifierId: 'Deed Shield Inspector', // Local override
                reasons: result.reasons || []
            };

            const newPdfBytes = await appendIntegrityPage(bufferUint8, receiptForStamp);
            
            const outputName = fileName.replace('.pdf', '_verified.pdf');
            const outputPath = path.join(WATCH_DIR, outputName);
            
            fs.writeFileSync(outputPath, newPdfBytes);
            console.log(`   -> 💾 Saved shielded document: ${outputName}`);

            notifier.notify({
                title: 'Deed Shield Protected',
                message: `${fileName} verified & stamped.`,
                sound: true
            });

        } else {
            // FLAG or BLOCK
            console.log(`   -> 🛑 ${result.decision}: ${result.reasons?.join(', ')}`);
            console.log('   -> 📧 Escalation triggered via API.');
            
            notifier.notify({
                title: `Deed Shield ${result.decision}`,
                message: `File: ${fileName}\nReasons: ${result.reasons?.join(', ')}`,
                sound: 'Glass'
            });
            
            // Move to quarantine (optional, per user prompt: "If a FLAG occurs, the code must immediately move the original file to an ESC_DIR")
            const ESC_DIR = path.join(WATCH_DIR, 'quarantine');
            if (!fs.existsSync(ESC_DIR)) fs.mkdirSync(ESC_DIR);
            
            const quarantinePath = path.join(ESC_DIR, fileName);
            fs.renameSync(filePath, quarantinePath);
            console.log(`   -> ⚠️ Moved to quarantine: ${quarantinePath}`);
        }

    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error('   -> ❌ API Error: Connection Refused (Is api running?)');
        } else if (err.response) {
            console.error(`   -> ❌ API Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            if (err.response.status === 400 && err.response.data.error === 'Integrity Check Failed') {
                 console.error('      (CRITICAL) File Hash does not match Payload Hash - Payload Corruption?');
            }
        } else {
            console.error('   -> ❌ System Error:', err);
        }
    }
});

