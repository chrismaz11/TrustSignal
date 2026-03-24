// Verifies that dist/index.js is in sync with src/index.js.
// Run as part of CI and before every release to confirm the committed dist
// entrypoint reflects the current source.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(relPath) {
  const absPath = path.resolve(__dirname, '..', relPath);
  const content = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const srcHash = sha256File('src/index.js');
const distHash = sha256File('dist/index.js');

if (srcHash !== distHash) {
  process.stderr.write('dist/index.js is out of sync with src/index.js\n');
  process.stderr.write(`  src:  ${srcHash}\n`);
  process.stderr.write(`  dist: ${distHash}\n`);
  process.stderr.write('Run: npm run build\n');
  process.exit(1);
}

process.stdout.write('dist/index.js is in sync with src/index.js\n');
