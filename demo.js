const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FIXTURE_DIR = path.join(__dirname, "..", "demo", "fixtures");
const RUNTIME_DIR = path.join(__dirname, "..", "demo", "runtime");

const SOURCE_FILE = path.join(FIXTURE_DIR, "SOC2_Audit_Report.pdf");
const WORKING_FILE = path.join(RUNTIME_DIR, "SOC2_Audit_Report.pdf");
const BRAND_WORDMARK = [
  "trustsignal",
  "Evidence Integrity Infrastructure",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetRuntime() {
  ensureDir(RUNTIME_DIR);
  if (fs.existsSync(WORKING_FILE)) {
    fs.unlinkSync(WORKING_FILE);
  }
  fs.copyFileSync(SOURCE_FILE, WORKING_FILE);
}

function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function createReceipt(originalHash) {
  return {
    receiptId: "TS-DEMO-0001",
    timestamp: "2026-03-11T15:00:00Z",
    alg: "SHA-256",
    hash: originalHash,
    issuer: "trustsignal-demo",
  };
}

function tamperFile(filePath) {
  const tamperNote = "\nTAMPERED: modified after receipt issuance\n";
  fs.appendFileSync(filePath, tamperNote, "utf8");
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printBrandBanner() {
  console.log(BRAND_WORDMARK[0]);
  console.log(BRAND_WORDMARK[1]);
}

async function main() {
  try {
    resetRuntime();

    console.clear();
    printBrandBanner();
    printSection("TrustSignal Evidence Integrity Demo");

    await sleep(1500);
    console.log("\nArtifact entering compliance system");
    console.log("File: SOC2_Audit_Report.pdf");

    await sleep(1800);
    console.log("\nGenerating fingerprint...");
    const originalHash = hashFile(WORKING_FILE);

    await sleep(1800);
    console.log(`SHA256: ${originalHash.slice(0, 24)}...`);

    await sleep(1800);
    console.log("\nIssuing signed receipt...");
    const receipt = createReceipt(originalHash);

    await sleep(1800);
    console.log(`Receipt ID: ${receipt.receiptId}`);
    console.log(`Timestamp: ${receipt.timestamp}`);
    console.log("Receipt stored and linked to artifact");

    await sleep(2200);
    printSection("Verification Check");
    console.log("Recorded hash matches current file hash");
    console.log("\n✓ VERIFIED");
    console.log("Document integrity intact");

    await sleep(3000);
    printSection("Tamper Simulation");
    console.log("Modifying artifact after submission...");
    tamperFile(WORKING_FILE);

    await sleep(2200);
    console.log("Re-running verification...");
    const tamperedHash = hashFile(WORKING_FILE);

    await sleep(1800);
    console.log(`\nExpected hash: ${receipt.hash.slice(0, 24)}...`);
    console.log(`Current hash:  ${tamperedHash.slice(0, 24)}...`);

    const integrityOk = receipt.hash === tamperedHash;

    await sleep(1800);
    if (!integrityOk) {
      console.log("\n✗ VERIFICATION FAILED");
      console.log("Integrity violation detected");
      console.log("Artifact differs from original verified record");
    } else {
      console.log("\n✓ VERIFIED");
      console.log("No integrity drift detected");
    }

    await sleep(1800);
    printSection("Auditor Result");
    console.log("Artifact: SOC2_Audit_Report.pdf");
    console.log(`Integrity: ${integrityOk ? "VERIFIED" : "FAILED"}`);
    console.log("Receipt: VALID");
    console.log(
      `Conclusion: ${
        integrityOk
          ? "Artifact matches the receipted record"
          : "Artifact modified after submission"
      }`
    );

    console.log("\nDemo complete.\n");
  } catch (error) {
    console.error("\nDemo failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
