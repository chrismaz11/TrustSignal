const crypto = require('crypto');
const Busboy = require('busboy');
const { loadEnvLocal, getIssuerDid, getIssuerPrivateJwk } = require('../lib/env');
const { evaluateReceiptPolicy } = require('../lib/policy');

loadEnvLocal();

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map((v) => JSON.parse(stableStringify(v))).map((v)=>JSON.stringify(v)).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const result = {};
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === 'object') {
      result[k] = JSON.parse(stableStringify(v));
    } else {
      result[k] = v;
    }
  }
  return JSON.stringify(result);
}

function derToJose(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('bad_der');
  let len = der[i++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | der[i++];
  }
  if (der[i++] !== 0x02) throw new Error('bad_der');
  let rLen = der[i++];
  let r = der.slice(i, i + rLen);
  i += rLen;
  if (der[i++] !== 0x02) throw new Error('bad_der');
  let sLen = der[i++];
  let s = der.slice(i, i + sLen);
  const normalize = (x) => {
    while (x.length > 1 && x[0] === 0x00) x = x.slice(1);
    if (x.length > 32) x = x.slice(x.length - 32);
    if (x.length < 32) x = Buffer.concat([Buffer.alloc(32 - x.length, 0), x]);
    return x;
  };
  r = normalize(r);
  s = normalize(s);
  return Buffer.concat([r, s]);
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null;

    let bb;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: 25 * 1024 * 1024 },
      });
    } catch (err) {
      reject(err);
      return;
    }

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () => {
        bb.emit('error', new Error('file_too_large'));
      });
      stream.on('end', () => {
        file = {
          fieldname: name,
          filename: filename || 'upload',
          contentType: mimeType || 'application/octet-stream',
          data: Buffer.concat(chunks),
        };
      });
    });

    bb.on('error', reject);
    bb.on('finish', () => resolve({ fields, file }));

    req.pipe(bb);
  });
}

async function handleReceipt(req, res) {
  try {
    const { fields, file } = await parseMultipart(req);
    if (!file || !file.data) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing_file' }));
      return;
    }
    const jurisdiction = fields.jurisdiction || '';
    const docType = fields.docType || '';
    const notaryId = fields.notaryId || '';
    const contentBindingMode = (fields.contentBindingMode || 'attested').toLowerCase();
    const operatorConfirmed = ['true', '1', 'on', 'yes', 'checked'].includes(
      String(fields.operatorConfirmed || '').toLowerCase()
    );

    const documentHash = sha256Hex(file.data);

    let textExtraction = { attempted: false, success: false, text: '' };
    if (contentBindingMode === 'text_match') {
      textExtraction.attempted = true;
      try {
        // Lazy-require to avoid hard dependency if not used.
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        const pdfParse = require('pdf-parse');
        return pdfParse(file.data)
          .then((data) => {
            textExtraction = { attempted: true, success: true, text: data.text || '' };
          })
          .catch(() => {
            textExtraction = { attempted: true, success: false, text: '' };
          })
          .finally(() => {
            continueHandle();
          });
      } catch (err) {
        textExtraction = { attempted: true, success: false, text: '' };
        continueHandle();
        return;
      }
    }

    function continueHandle() {
      const policy = evaluateReceiptPolicy({
        jurisdiction,
        docType,
        notaryId,
        documentHash,
        contentBindingMode,
        operatorConfirmed,
        textExtraction,
      });

      const receipt = {
        trustSignalVersion: '0.1',
        verifiedAt: new Date().toISOString(),
        jurisdiction,
        docType,
        notaryId,
        documentHash,
        contentBindingMode,
        operatorConfirmed,
        bindingEvidence: {
          mode: contentBindingMode,
          operatorConfirmed,
          textMatchAttempted: !!textExtraction.attempted,
          textMatchSucceeded: !!textExtraction.success,
        },
        policyVersion: 'mvp-0.3',
        result: policy.result,
        flags: Array.isArray(policy.flags) ? policy.flags : [],
        anchor: {
          network: 'polygon-amoy',
          chainId: 80002,
          txHash: null,
        },
      };

      const canonical = stableStringify(receipt);
      const receiptHash = sha256Hex(Buffer.from(canonical, 'utf8'));
      receipt.receiptHash = receiptHash;

      const cs = {
        documentHash,
        receiptHash,
        jurisdiction,
        docType,
        notaryId,
        contentBindingMode,
        operatorConfirmed,
        result: receipt.result,
        flags: receipt.flags,
      };
      const issuer = getIssuerDid();
      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + 30 * 24 * 60 * 60;
      const payload = {
        iss: issuer,
        sub: documentHash,
        jti: crypto.randomBytes(16).toString('hex'),
        iat,
        nbf: iat,
        exp,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'RecordEventAttestation'],
          credentialSubject: cs,
        },
      };

      const header = { alg: 'ES256', typ: 'JWT' };
      const encHeader = base64url(JSON.stringify(header));
      const encPayload = base64url(JSON.stringify(payload));
      const signingInput = `${encHeader}.${encPayload}`;

      const jwk = getIssuerPrivateJwk();
      const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
      const derSig = crypto.sign('sha256', Buffer.from(signingInput), key);
      const joseSig = derToJose(derSig);
      const jwt = `${signingInput}.${base64url(joseSig)}`;

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ receipt, attestation_jwt: jwt }));
    }

    // If not text_match, proceed synchronously.
    if (contentBindingMode !== 'text_match') {
      continueHandle();
    } else if (!textExtraction.attempted) {
      continueHandle();
    }
  } catch (e) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'bad_request' }));
  }
}

module.exports = {
  handleReceipt,
};
