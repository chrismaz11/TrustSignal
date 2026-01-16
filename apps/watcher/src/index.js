const chokidar = require('chokidar');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const notifier = require('node-notifier');

const WATCH_DIR = path.join(__dirname, '../watched_folder');
const API_URL = 'http://127.0.0.1:3001/api/v1/verify';

// Ensure watch directory exists
if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR);
    console.log(`Created watch directory: ${WATCH_DIR}`);
}

console.log(`DeedShield Watcher Service started.`);
console.log(`Monitoring: ${WATCH_DIR}`);

const watcher = chokidar.watch(WATCH_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't process existing files on startup for this demo
    awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
    }
});

watcher.on('add', async (filePath) => {
    const fileName = path.basename(filePath);
    console.log(`\n[DETECTED] New file: ${fileName}`);

    try {
        // 1. Client-Side Hashing (Privacy First)
        console.log(' -> Hashing file locally...');
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const docHash = hashSum.digest('hex');
        console.log(` -> SHA-256: ${docHash.substring(0, 16)}...`);

        // 2. Prepare Payload (Mocking Context)
        // In production, this would grab context from the TPS (SoftPro/Qualia)
        const payload = {
            bundleId: `WATCHER-${Date.now()}`,
            transactionType: 'refinance',
            ron: {
                provider: 'DemoProvider',
                notaryId: 'NOTARY-DEMO',
                commissionState: 'TX',
                sealPayload: 'mock-seal-signature', // Mocked for watcher demo
                sealScheme: 'SIM-ECDSA-v1'
            },
            doc: {
                docHash: docHash // The ACTUAL hash of the file
            },
            policy: {
                profile: 'STANDARD_TX'
            },
            property: {
                // Attempt to guess from filename or default (Demo Logic)
                parcelId: fileName.includes('BAD') ? 'SCAM-101' : 'PARCEL-999',
                county: 'Travis County',
                state: 'TX'
            },
            timestamp: new Date().toISOString()
        };

        // 3. Verify via API
        console.log(' -> Verifying against Deed Shield Network...');
        const response = await axios.post(API_URL, payload);
        const result = response.data;

        // 4. Notify User
        if (result.decision === 'ALLOW') {
            console.log(` -> ✅ RESULT: VERIFIED (Score: ${result.riskScore})`);
            notifier.notify({
                title: 'Deed Shield Verified',
                message: `File: ${fileName}\nStatus: Is Clean (Score: 0)`,
                sound: true
            });
        } else {
            console.log(` -> ⚠️ RESULT: ${result.decision}`);
            const reasons = Array.isArray(result.reasons) ? result.reasons.join(', ') : 'Unknown risks';
            notifier.notify({
                title: 'Deed Shield Alert',
                message: `File: ${fileName}\nFlagged: ${reasons}`,
                sound: 'Glass'
            });
        }

    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error(' -> ❌ ERROR: API Server is unreachable. Is it running on port 3001?');
            notifier.notify({ title: 'Deed Shield Error', message: 'Could not connect to Verification Server.' });
        } else {
            console.error(' -> ❌ ERROR:', err.message);
            if (err.response) {
                console.error('    Details:', JSON.stringify(err.response.data, null, 2));
            }
        }
    }
});
