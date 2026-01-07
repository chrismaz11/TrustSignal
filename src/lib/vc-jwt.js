const crypto = require('crypto');

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecodeToBuffer(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + '='.repeat(padLen);
  return Buffer.from(withPad, 'base64');
}

function toDerInteger(buf) {
  let b = Buffer.from(buf);
  while (b.length > 1 && b[0] === 0x00 && (b[1] & 0x80) === 0) b = b.slice(1);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
  return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}

function es256JoseToDer(sig) {
  if (!Buffer.isBuffer(sig)) throw new Error('sig must be a buffer');
  if (sig.length !== 64) throw new Error('invalid ES256 signature length');
  const r = sig.slice(0, 32);
  const s = sig.slice(32);
  const rDer = toDerInteger(r);
  const sDer = toDerInteger(s);
  const seqLen = rDer.length + sDer.length;
  return Buffer.concat([Buffer.from([0x30, seqLen]), rDer, sDer]);
}

function randomJti() {
  return crypto.randomBytes(16).toString('hex');
}

function issueVcJwt({
  issuer,
  subject,
  secret,
  now = new Date(),
  expiresInSeconds = 60 * 60,
}) {
  if (!issuer) throw new Error('issuer is required');
  if (!secret) throw new Error('secret is required');
  if (!subject) throw new Error('subject is required');

  const required = ['instrumentNo', 'parcelId', 'recordedAt', 'docType'];
  for (const k of required) {
    if (subject[k] === undefined || subject[k] === null || subject[k] === '') {
      throw new Error(`subject.${k} is required`);
    }
  }

  const jti = randomJti();
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + expiresInSeconds;

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    iss: issuer,
    sub: subject.parcelId,
    jti,
    iat,
    exp,
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'RecordEventAttestation'],
      credentialSubject: {
        instrumentNo: subject.instrumentNo,
        parcelId: subject.parcelId,
        recordedAt: subject.recordedAt,
        docType: subject.docType,
      },
    },
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const encodedSig = base64urlEncode(sig);

  return {
    jwt: `${signingInput}.${encodedSig}`,
    payload,
  };
}

function decodeJwtUnsafe(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('invalid JWT format');
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64urlDecodeToBuffer(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64urlDecodeToBuffer(encodedPayload).toString('utf8'));
  } catch {
    throw new Error('bad_encoding');
  }
  return { header, payload, encodedHeader, encodedPayload, encodedSig };
}

function verifyVcJwt({ jwt, publicJwk, now = new Date() }) {
  if (!jwt) throw new Error('jwt is required');
  if (!publicJwk) throw new Error('publicJwk is required');

  let decoded;
  try {
    decoded = decodeJwtUnsafe(jwt);
  } catch {
    return { verified: false, error: 'bad_encoding' };
  }

  const { header, payload, encodedHeader, encodedPayload, encodedSig } = decoded;
  if (!header || header.alg !== 'ES256') {
    return { verified: false, error: 'unsupported_alg' };
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  let publicKey;
  try {
    publicKey = crypto.createPublicKey({ key: publicJwk, format: 'jwk' });
  } catch {
    return { verified: false, error: 'bad_issuer_key' };
  }

  let sig;
  try {
    sig = es256JoseToDer(base64urlDecodeToBuffer(encodedSig));
  } catch {
    return { verified: false, error: 'bad_signature' };
  }

  const ok = crypto.verify('sha256', Buffer.from(signingInput), publicKey, sig);
  if (!ok) {
    return { verified: false, error: 'bad_signature' };
  }

  const nowSec = Math.floor(now.getTime() / 1000);
  if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
    return { verified: false, error: 'expired' };
  }
  if (typeof payload.nbf === 'number' && nowSec < payload.nbf) {
    return { verified: false, error: 'not_active' };
  }
  if (typeof payload.iat === 'number' && nowSec < payload.iat) {
    return { verified: false, error: 'iat_in_future' };
  }

  const types = payload?.vc?.type;
  if (!Array.isArray(types) || !types.includes('RecordEventAttestation')) {
    return { verified: false, error: 'missing_type' };
  }

  const cs = payload?.vc?.credentialSubject;
  const required = ['instrumentNo', 'parcelId', 'recordedAt', 'docType'];
  for (const k of required) {
    if (!cs || cs[k] === undefined || cs[k] === null || cs[k] === '') {
      return { verified: false, error: `missing_subject_${k}` };
    }
  }

  return { verified: true, payload };
}

module.exports = {
  issueVcJwt,
  verifyVcJwt,
  decodeJwtUnsafe,
};
