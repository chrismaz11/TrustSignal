use non_mem_gadget::attestation::{
    generate_attestation_proof, verify_attestation_proof, AttestationPublicInputs,
    Halo2ProofArtifact, ATTESTATION_CIRCUIT_ID, ATTESTATION_ENCODING,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead, Write};

const SERVICE_SCHEME: &str = "HALO2-v1";
const SERVICE_STATUS: &str = "verifiable";
const SERVICE_BACKEND: &str = "halo2";

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "lowercase")]
enum Request {
    Prove {
        #[serde(rename = "publicInputs")]
        public_inputs: PublicInputs,
        #[serde(rename = "privateWitness")]
        private_witness: PrivateWitness,
    },
    Verify {
        attestation: ZkpAttestation,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestEnvelope {
    request_id: Option<String>,
    #[serde(flatten)]
    request: Request,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicInputs {
    policy_hash: String,
    timestamp: String,
    inputs_commitment: String,
    conformance: bool,
    declared_doc_hash: String,
    document_digest: String,
    document_commitment: String,
    schema_version: String,
    document_witness_mode: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrivateWitness {
    canonical_document_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ZkpAttestation {
    proof_id: String,
    scheme: String,
    status: String,
    backend: String,
    circuit_id: Option<String>,
    public_inputs: PublicInputs,
    proof_artifact: Option<ProofArtifact>,
    verification_key_id: Option<String>,
    verified_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProofArtifact {
    format: String,
    digest: String,
    encoding: Option<String>,
    proof: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProveResponse {
    attestation: OutputAttestation,
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    verified: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputAttestation {
    proof_id: String,
    scheme: String,
    status: String,
    backend: String,
    circuit_id: String,
    public_inputs: PublicInputs,
    proof_artifact: OutputProofArtifact,
    verification_key_id: String,
    verified_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputProofArtifact {
    format: String,
    digest: String,
    encoding: String,
    proof: String,
}

fn to_public_inputs(public_inputs: PublicInputs) -> AttestationPublicInputs {
    AttestationPublicInputs {
        policy_hash: public_inputs.policy_hash,
        timestamp: public_inputs.timestamp,
        inputs_commitment: public_inputs.inputs_commitment,
        conformance: public_inputs.conformance,
        declared_doc_hash: public_inputs.declared_doc_hash,
        document_digest: public_inputs.document_digest,
        document_commitment: public_inputs.document_commitment,
        schema_version: public_inputs.schema_version,
        document_witness_mode: public_inputs.document_witness_mode,
    }
}

fn build_output_attestation(
    public_inputs: PublicInputs,
    proof_artifact: Halo2ProofArtifact,
    verification_key_id: String,
) -> OutputAttestation {
    OutputAttestation {
        proof_id: proof_artifact.digest.clone(),
        scheme: SERVICE_SCHEME.to_string(),
        status: SERVICE_STATUS.to_string(),
        backend: SERVICE_BACKEND.to_string(),
        circuit_id: ATTESTATION_CIRCUIT_ID.to_string(),
        verified_at: public_inputs.timestamp.clone(),
        public_inputs,
        proof_artifact: OutputProofArtifact {
            format: proof_artifact.format,
            digest: proof_artifact.digest,
            encoding: proof_artifact.encoding,
            proof: proof_artifact.proof,
        },
        verification_key_id,
    }
}

fn supports_verifiable_halo2_attestation(
    attestation: &ZkpAttestation,
    artifact: &ProofArtifact,
) -> bool {
    attestation.scheme == SERVICE_SCHEME
        && attestation.status == SERVICE_STATUS
        && attestation.backend == SERVICE_BACKEND
        && attestation.circuit_id.as_deref() == Some(ATTESTATION_CIRCUIT_ID)
        && attestation
            .verified_at
            .as_deref()
            .is_some_and(|value| !value.is_empty())
        && !attestation.proof_id.is_empty()
        && attestation.proof_id == artifact.digest
}

fn handle_request(request: Request) -> Result<Value, String> {
    match request {
        Request::Prove {
            public_inputs,
            private_witness,
        } => {
            let attestation = generate_attestation_proof(
                &to_public_inputs(public_inputs.clone()),
                &private_witness.canonical_document_base64,
            )?;
            serde_json::to_value(ProveResponse {
                attestation: build_output_attestation(
                    public_inputs,
                    attestation.proof_artifact,
                    attestation.verification_key_id,
                ),
            })
            .map_err(|error| error.to_string())
        }
        Request::Verify { attestation } => {
            let artifact = attestation
                .proof_artifact
                .as_ref()
                .ok_or_else(|| "missing proof artifact".to_string())?;
            let verification_key_id = attestation
                .verification_key_id
                .as_deref()
                .ok_or_else(|| "missing verification key id".to_string())?;
            let verified = supports_verifiable_halo2_attestation(&attestation, artifact)
                && verify_attestation_proof(
                    &to_public_inputs(attestation.public_inputs),
                    &Halo2ProofArtifact {
                        format: artifact.format.clone(),
                        digest: artifact.digest.clone(),
                        encoding: artifact
                            .encoding
                            .clone()
                            .unwrap_or_else(|| ATTESTATION_ENCODING.to_string()),
                        proof: artifact
                            .proof
                            .clone()
                            .ok_or_else(|| "missing proof bytes".to_string())?,
                    },
                    verification_key_id,
                )
                .is_ok();

            serde_json::to_value(VerifyResponse { verified }).map_err(|error| error.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{handle_request, Request};

    fn prove_request() -> Request {
        serde_json::from_str(
            r#"{
                "action":"prove",
                "publicInputs":{
                    "policyHash":"0x8d37c4e7bf2d6ad0d9d0f0fb158df50eaf7169a42f8c640842d2f275527a4387",
                    "timestamp":"2026-03-07T00:00:00.000Z",
                    "inputsCommitment":"0xf6f29cfb24ae8c3f141d45ce8fb8a4f60c3d31aa99f6fd777db1966db93f9f9e",
                    "conformance":true,
                    "declaredDocHash":"0xd2c59808f4bcb6d57e0169fb0fb3d3c16f2c6d082b8dc4b12f3ecacc10bd4f43",
                    "documentDigest":"0x60e3f0824cfc357f52b8838944b38dcf7dbde93e00adab3165d73d0c7f6874ef",
                    "documentCommitment":"0xd815372db431d555c76b92aa4507f108fd7e7120f59b60988228836e0219d25d",
                    "schemaVersion":"trustsignal.document_sha256.v1",
                    "documentWitnessMode":"canonical-document-bytes-v1"
                },
                "privateWitness":{
                    "canonicalDocumentBase64":"JVBERi0xLjQKc2FtcGxl"
                }
            }"#,
        )
        .expect("request should parse")
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
    fn prove_then_verify_round_trip_succeeds() {
        let prove_response = handle_request(prove_request()).expect("prove request should succeed");
        let prove_json = prove_response;

        let verify_request = serde_json::json!({
            "action": "verify",
            "attestation": prove_json["attestation"].clone(),
        });
        let verify_response = handle_request(
            serde_json::from_value(verify_request).expect("verify request should parse"),
        )
        .expect("verify request should succeed");
        let verify_json = verify_response;

        assert_eq!(verify_json, serde_json::json!({ "verified": true }));
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release zkp_service"]
    fn verify_rejects_mismatched_proof_id() {
        let prove_response = handle_request(prove_request()).expect("prove request should succeed");
        let mut prove_json = prove_response;
        prove_json["attestation"]["proofId"] = serde_json::json!("0xnot-the-digest");

        let verify_request = serde_json::json!({
            "action": "verify",
            "attestation": prove_json["attestation"].clone(),
        });
        let verify_response = handle_request(
            serde_json::from_value(verify_request).expect("verify request should parse"),
        )
        .expect("verify request should succeed");
        let verify_json = verify_response;

        assert_eq!(verify_json, serde_json::json!({ "verified": false }));
    }
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    for line in stdin.lock().lines() {
        let payload = match line {
            Ok(payload) => payload,
            Err(error) => {
                eprintln!("failed to read request: {error}");
                std::process::exit(2);
            }
        };
        if payload.trim().is_empty() {
            continue;
        }

        let envelope = match serde_json::from_str::<RequestEnvelope>(&payload) {
            Ok(envelope) => envelope,
            Err(error) => {
                eprintln!("failed to parse request: {error}");
                std::process::exit(2);
            }
        };

        match handle_request(envelope.request) {
            Ok(mut response) => {
                if let Some(request_id) = envelope.request_id {
                    if let Some(object) = response.as_object_mut() {
                        object.insert("requestId".to_string(), Value::String(request_id));
                    }
                }
                if let Err(error) = writeln!(stdout, "{response}") {
                    eprintln!("failed to write response: {error}");
                    std::process::exit(2);
                }
                if let Err(error) = stdout.flush() {
                    eprintln!("failed to flush response: {error}");
                    std::process::exit(2);
                }
            }
            Err(error) => {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
    }
}
