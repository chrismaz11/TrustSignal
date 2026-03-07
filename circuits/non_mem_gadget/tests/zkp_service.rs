use serde_json::{json, Value};
use std::io::Write;
use std::process::{Command, Output, Stdio};

fn service_binary() -> &'static str {
    env!("CARGO_BIN_EXE_zkp_service")
}

fn run_service(request: &Value) -> Output {
    let mut child = Command::new(service_binary())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("zkp_service binary should spawn");

    child
        .stdin
        .as_mut()
        .expect("stdin should be available")
        .write_all(request.to_string().as_bytes())
        .expect("request should write");

    child
        .wait_with_output()
        .expect("service should exit cleanly")
}

fn prove_request() -> Value {
    json!({
        "action": "prove",
        "publicInputs": {
            "policyHash": "0x8d37c4e7bf2d6ad0d9d0f0fb158df50eaf7169a42f8c640842d2f275527a4387",
            "timestamp": "2026-03-07T00:00:00.000Z",
            "inputsCommitment": "0xf6f29cfb24ae8c3f141d45ce8fb8a4f60c3d31aa99f6fd777db1966db93f9f9e",
            "conformance": true,
            "declaredDocHash": "0xd2c59808f4bcb6d57e0169fb0fb3d3c16f2c6d082b8dc4b12f3ecacc10bd4f43",
            "documentDigest": "0x60e3f0824cfc357f52b8838944b38dcf7dbde93e00adab3165d73d0c7f6874ef",
            "documentCommitment": "0xd815372db431d555c76b92aa4507f108fd7e7120f59b60988228836e0219d25d",
            "schemaVersion": "trustsignal.document_sha256.v1",
            "documentWitnessMode": "canonical-document-bytes-v1"
        },
        "privateWitness": {
            "canonicalDocumentBase64": "JVBERi0xLjQKc2FtcGxl"
        }
    })
}

fn prove_attestation() -> Value {
    let output = run_service(&prove_request());
    assert!(
        output.status.success(),
        "prove request failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let response: Value =
        serde_json::from_slice(&output.stdout).expect("prove response should be valid json");
    response["attestation"].clone()
}

#[test]
#[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
fn prove_response_matches_external_protocol_shape() {
    let attestation = prove_attestation();

    assert_eq!(attestation["scheme"], "HALO2-v1");
    assert_eq!(attestation["status"], "verifiable");
    assert_eq!(attestation["backend"], "halo2");
    assert_eq!(attestation["circuitId"], "document-sha256-v1");
    assert_eq!(
        attestation["proofId"],
        attestation["proofArtifact"]["digest"]
    );
    assert_eq!(attestation["verifiedAt"], "2026-03-07T00:00:00.000Z");
    assert_eq!(
        attestation["publicInputs"]["documentWitnessMode"],
        "canonical-document-bytes-v1"
    );
}

#[test]
#[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
fn verify_accepts_service_generated_attestation() {
    let request = json!({
        "action": "verify",
        "attestation": prove_attestation(),
    });
    let output = run_service(&request);

    assert!(
        output.status.success(),
        "verify request failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: Value =
        serde_json::from_slice(&output.stdout).expect("verify response should be valid json");
    assert_eq!(response, json!({ "verified": true }));
}

#[test]
#[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
fn verify_rejects_tampered_digest_even_when_envelope_matches() {
    let mut attestation = prove_attestation();
    attestation["proofId"] = json!("0xdeadbeef");
    attestation["proofArtifact"]["digest"] = json!("0xdeadbeef");

    let request = json!({
        "action": "verify",
        "attestation": attestation,
    });
    let output = run_service(&request);

    assert!(
        output.status.success(),
        "verify request failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: Value =
        serde_json::from_slice(&output.stdout).expect("verify response should be valid json");
    assert_eq!(response, json!({ "verified": false }));
}

#[test]
#[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
fn verify_errors_on_missing_proof_artifact() {
    let mut attestation = prove_attestation();
    attestation
        .as_object_mut()
        .expect("attestation should be an object")
        .remove("proofArtifact");

    let request = json!({
        "action": "verify",
        "attestation": attestation,
    });
    let output = run_service(&request);

    assert!(
        !output.status.success(),
        "missing proof artifact should fail"
    );
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("missing proof artifact"),
        "unexpected stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
