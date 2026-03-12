import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { exportJWK, generateKeyPair } from "jose";

import { canonicalizeJson } from "../packages/core/src/canonicalize.ts";
import { keccak256Utf8 } from "../packages/core/src/hashing.ts";
import { buildReceipt, computeReceiptHash, toUnsignedReceiptPayload } from "../packages/core/src/receipt.ts";
import { signReceiptPayload, verifyReceiptSignature } from "../packages/core/src/receiptSigner.ts";
import type { BundleInput, Receipt, VerificationResult } from "../packages/core/src/types.ts";

type DemoArtifact = {
  artifactId: string;
  artifactType: string;
  sourceSystem: string;
  collectedAt: string;
  subject: {
    parcelId: string;
    county: string;
    state: string;
  };
  document: {
    title: string;
    documentNumber: string;
    digestSource: string;
  };
  parties: {
    grantor: string;
    grantee: string;
  };
};

type PersistedReceipt = {
  verificationId: string;
  artifactHash: string;
  receipt: Receipt;
  verificationResult: VerificationResult;
  issuer: {
    kid: string;
    publicJwk: Awaited<ReturnType<typeof exportJWK>>;
  };
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(currentDir, "output");
const persistedReceiptPath = path.join(outputDir, "verification-receipt.json");

function formatStep(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function loadArtifact(fileName: string): Promise<DemoArtifact> {
  const filePath = path.join(currentDir, fileName);
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as DemoArtifact;
}

function hashArtifact(artifact: DemoArtifact): string {
  return keccak256Utf8(canonicalizeJson(artifact));
}

function toBundleInput(artifact: DemoArtifact, artifactHash: string): BundleInput {
  return {
    bundleId: artifact.artifactId,
    transactionType: artifact.artifactType,
    ron: {
      provider: artifact.sourceSystem,
      notaryId: "NOTARY-DEMO-01",
      commissionState: artifact.subject.state,
      sealPayload: "demo-seal-payload"
    },
    doc: {
      docHash: artifactHash
    },
    property: artifact.subject,
    policy: {
      profile: "DEMO_INTEGRITY_V1"
    },
    timestamp: artifact.collectedAt
  };
}

function runVerification(artifact: DemoArtifact, artifactHash: string): VerificationResult {
  return {
    decision: "ALLOW",
    reasons: [
      "artifact accepted into verification lifecycle",
      "signed verification receipt issued"
    ],
    riskScore: 11,
    checks: [
      {
        checkId: "artifact.hash.bound",
        status: "PASS",
        details: `artifact hash recorded: ${artifactHash}`
      },
      {
        checkId: "artifact.provenance.source",
        status: "PASS",
        details: `source recorded: ${artifact.sourceSystem}`
      },
      {
        checkId: "artifact.provenance.subject",
        status: "PASS",
        details: `${artifact.subject.county} County ${artifact.subject.state} parcel ${artifact.subject.parcelId}`
      }
    ]
  };
}

async function issueReceipt(artifact: DemoArtifact): Promise<PersistedReceipt> {
  const artifactHash = hashArtifact(artifact);
  const bundleInput = toBundleInput(artifact, artifactHash);
  const verificationResult = runVerification(artifact, artifactHash);
  const receipt = buildReceipt(bundleInput, verificationResult, "trustsignal-demo");

  const { privateKey, publicKey } = await generateKeyPair("EdDSA");
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);

  const unsignedReceipt = toUnsignedReceiptPayload(receipt);
  const receiptSignature = await signReceiptPayload(unsignedReceipt, {
    privateJwk,
    kid: "trustsignal-demo-key"
  });

  const signedReceipt: Receipt = {
    ...receipt,
    receiptSignature
  };

  return {
    verificationId: signedReceipt.receiptId,
    artifactHash,
    receipt: signedReceipt,
    verificationResult,
    issuer: {
      kid: "trustsignal-demo-key",
      publicJwk
    }
  };
}

async function persistReceipt(record: PersistedReceipt): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(persistedReceiptPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function loadPersistedReceipt(): Promise<PersistedReceipt> {
  const contents = await readFile(persistedReceiptPath, "utf8");
  return JSON.parse(contents) as PersistedReceipt;
}

async function verifyLater(artifact: DemoArtifact, persisted: PersistedReceipt) {
  const artifactHash = hashArtifact(artifact);
  const unsignedReceipt = toUnsignedReceiptPayload(persisted.receipt);
  const recomputedReceiptHash = computeReceiptHash(unsignedReceipt);
  const signatureResult =
    persisted.receipt.receiptSignature == null
      ? {
          verified: false,
          keyResolved: false,
          payloadMatches: false,
          kid: persisted.issuer.kid,
          alg: "EdDSA",
          reason: "missing_signature"
        }
      : await verifyReceiptSignature(unsignedReceipt, persisted.receipt.receiptSignature, {
          [persisted.issuer.kid]: persisted.issuer.publicJwk
        });

  return {
    artifactHash,
    matchesStoredArtifact: artifactHash === persisted.artifactHash,
    receiptHashMatches: recomputedReceiptHash === persisted.receipt.receiptHash,
    signatureVerified: signatureResult.verified,
    verificationResult: persisted.verificationResult.decision,
    receiptId: persisted.receipt.receiptId
  };
}

async function main() {
  const artifact = await loadArtifact("sample-artifact.json");
  const tamperedArtifact = await loadArtifact("tampered-artifact.json");

  formatStep("Artifact Intake");
  console.log(`artifact id: ${artifact.artifactId}`);
  console.log(`artifact hash: ${hashArtifact(artifact)}`);

  formatStep("Verification Result + Signed Receipt");
  const issuedReceipt = await issueReceipt(artifact);
  console.log(`verification result: ${issuedReceipt.verificationResult.decision}`);
  console.log(`receipt issuance: persisted signed receipt for ${issuedReceipt.receipt.receiptId}`);
  console.log(`receipt path: ${persistedReceiptPath}`);

  await persistReceipt(issuedReceipt);

  formatStep("Later Verification");
  const persistedReceipt = await loadPersistedReceipt();
  const laterVerification = await verifyLater(artifact, persistedReceipt);
  console.log(`later verification check: ${laterVerification.matchesStoredArtifact ? "MATCH" : "MISMATCH"}`);
  console.log(`receipt hash verified: ${laterVerification.receiptHashMatches ? "YES" : "NO"}`);
  console.log(`signature verified: ${laterVerification.signatureVerified ? "YES" : "NO"}`);

  formatStep("Tampered Artifact Detection");
  console.log(`tampered artifact hash: ${hashArtifact(tamperedArtifact)}`);
  const tamperedVerification = await verifyLater(tamperedArtifact, persistedReceipt);
  console.log(
    `tampered artifact mismatch: ${tamperedVerification.matchesStoredArtifact ? "NOT DETECTED" : "DETECTED"}`
  );

  if (
    !laterVerification.matchesStoredArtifact ||
    !laterVerification.receiptHashMatches ||
    !laterVerification.signatureVerified ||
    tamperedVerification.matchesStoredArtifact
  ) {
    throw new Error("Demo verification lifecycle failed");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
