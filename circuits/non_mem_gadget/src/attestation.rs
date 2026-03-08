use halo2_gadgets::sha256::{BlockWord, Sha256Instructions, Table16Chip, Table16Config};
use halo2_proofs::{
    circuit::{AssignedCell, Layouter, SimpleFloorPlanner, Value},
    pasta::{pallas, EqAffine},
    plonk::{
        create_proof, keygen_pk, keygen_vk, verify_proof, Advice, Circuit, Column,
        ConstraintSystem, Error, Instance, ProvingKey, SingleVerifier,
    },
    poly::commitment::Params,
    transcript::{Blake2bRead, Blake2bWrite, Challenge255},
};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
    sync::OnceLock,
};

pub const ATTESTATION_CIRCUIT_ID: &str = "document-sha256-v1";
pub const ATTESTATION_FORMAT: &str = "halo2-ipa-blake2b";
pub const ATTESTATION_ENCODING: &str = "base64";
pub const ATTESTATION_SCHEMA_VERSION: &str = "trustsignal.document_sha256.v1";
pub const ATTESTATION_WITNESS_MODE: &str = "canonical-document-bytes-v1";
pub const MAX_CANONICAL_DOCUMENT_BYTES: usize = 1024;
const ATTESTATION_K: u32 = 17;
const PARAMS_FILE_NAME: &str = "document-sha256-v1.k17.params";
const SETUP_MANIFEST_FILE_NAME: &str = "document-sha256-v1.k17.setup.json";

static DOCUMENT_SETUP: OnceLock<Result<DocumentSetup, String>> = OnceLock::new();

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AttestationPublicInputs {
    pub policy_hash: String,
    pub timestamp: String,
    pub inputs_commitment: String,
    pub conformance: bool,
    pub declared_doc_hash: String,
    pub document_digest: String,
    pub document_commitment: String,
    pub schema_version: String,
    pub document_witness_mode: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Halo2ProofArtifact {
    pub format: String,
    pub digest: String,
    pub encoding: String,
    pub proof: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Halo2Attestation {
    pub circuit_id: String,
    pub verification_key_id: String,
    pub proof_artifact: Halo2ProofArtifact,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct SetupManifest {
    circuit_id: String,
    params_k: u32,
    max_canonical_document_bytes: usize,
    verification_key_id: String,
}

#[derive(Clone, Debug)]
struct DocumentHashConfig {
    sha256: Table16Config,
    digest_instance: Column<Instance>,
    digest_advice: Column<Advice>,
}

#[derive(Clone, Debug, Default)]
struct DocumentHashCircuit {
    canonical_document_bytes: Vec<u8>,
}

struct DocumentSetup {
    params: Params<EqAffine>,
    pk: ProvingKey<EqAffine>,
    verification_key_id: String,
}

impl Circuit<pallas::Base> for DocumentHashCircuit {
    type Config = DocumentHashConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self::default()
    }

    fn configure(meta: &mut ConstraintSystem<pallas::Base>) -> Self::Config {
        let digest_instance = meta.instance_column();
        let digest_advice = meta.advice_column();
        meta.enable_equality(digest_instance);
        meta.enable_equality(digest_advice);

        DocumentHashConfig {
            sha256: Table16Chip::configure(meta),
            digest_instance,
            digest_advice,
        }
    }

    fn synthesize(
        &self,
        config: Self::Config,
        mut layouter: impl Layouter<pallas::Base>,
    ) -> Result<(), Error> {
        Table16Chip::load(config.sha256.clone(), &mut layouter)?;
        let chip = Table16Chip::construct(config.sha256);
        let blocks = padded_block_words(&self.canonical_document_bytes)
            .map_err(|_| Error::Synthesis)?;
        let mut state = chip.initialization_vector(&mut layouter.namespace(|| "sha256 iv"))?;

        for (index, block) in blocks.into_iter().enumerate() {
            if index > 0 {
                state = chip.initialization(
                    &mut layouter.namespace(|| format!("sha256 init {index}")),
                    &state,
                )?;
            }
            state = chip.compress(
                &mut layouter.namespace(|| format!("sha256 compress {index}")),
                &state,
                block,
            )?;
        }

        let digest = chip.digest(&mut layouter.namespace(|| "sha256 digest"), &state)?;
        let cells: Vec<AssignedCell<pallas::Base, pallas::Base>> = layouter.assign_region(
            || "expose document digest words",
            |mut region| {
                let mut cells = Vec::with_capacity(digest.len());
                for (row, word) in digest.iter().enumerate() {
                    let cell = region.assign_advice(
                        || format!("document digest word {row}"),
                        config.digest_advice,
                        row,
                        || word.0.map(|value| pallas::Base::from(value as u64)),
                    )?;
                    cells.push(cell);
                }
                Ok(cells)
            },
        )?;

        for (row, cell) in cells.iter().enumerate() {
            layouter.constrain_instance(cell.cell(), config.digest_instance, row)?;
        }

        Ok(())
    }
}

fn digest_hex(bytes: &[u8]) -> String {
    format!("0x{:x}", Sha256::digest(bytes))
}

fn decode_hex_digit(value: u8) -> Result<u8, String> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err("invalid hex digit".to_string()),
    }
}

fn decode_digest_hex(value: &str) -> Result<[u8; 32], String> {
    let hex = value.strip_prefix("0x").unwrap_or(value);
    if hex.len() != 64 {
        return Err(format!("expected 32-byte hex digest, received \"{value}\""));
    }

    let bytes = hex.as_bytes();
    let mut decoded = [0u8; 32];
    for (index, output) in decoded.iter_mut().enumerate() {
        let hi = decode_hex_digit(bytes[index * 2])?;
        let lo = decode_hex_digit(bytes[index * 2 + 1])?;
        *output = (hi << 4) | lo;
    }
    Ok(decoded)
}

fn digest_words(value: &str) -> Result<Vec<pallas::Base>, String> {
    let bytes = decode_digest_hex(value)?;
    Ok(bytes
        .chunks_exact(4)
        .map(|chunk| {
            let word = u32::from_be_bytes(chunk.try_into().expect("chunk length is fixed"));
            pallas::Base::from(word as u64)
        })
        .collect())
}

fn encode_string(value: &str) -> Vec<u8> {
    let payload = value.as_bytes();
    let mut encoded = Vec::with_capacity(4 + payload.len());
    encoded.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    encoded.extend_from_slice(payload);
    encoded
}

fn recompute_document_commitment(public_inputs: &AttestationPublicInputs) -> Result<String, String> {
    let mut preimage = Vec::new();
    preimage.extend_from_slice(&encode_string(&public_inputs.schema_version));
    preimage.extend_from_slice(&encode_string(&public_inputs.document_witness_mode));
    preimage.extend_from_slice(&decode_digest_hex(&public_inputs.declared_doc_hash)?);
    preimage.extend_from_slice(&decode_digest_hex(&public_inputs.document_digest)?);
    preimage.extend_from_slice(&decode_digest_hex(&public_inputs.policy_hash)?);
    preimage.extend_from_slice(&decode_digest_hex(&public_inputs.inputs_commitment)?);
    preimage.extend_from_slice(&encode_string(&public_inputs.timestamp));
    preimage.push(if public_inputs.conformance { 1 } else { 0 });
    Ok(digest_hex(&preimage))
}

fn validate_public_inputs(public_inputs: &AttestationPublicInputs) -> Result<(), String> {
    if public_inputs.schema_version != ATTESTATION_SCHEMA_VERSION {
        return Err("unsupported attestation schema version".to_string());
    }
    if public_inputs.document_witness_mode != ATTESTATION_WITNESS_MODE {
        return Err("unsupported document witness mode".to_string());
    }
    if public_inputs.timestamp.trim().is_empty() {
        return Err("timestamp is required".to_string());
    }

    for digest in [
        &public_inputs.policy_hash,
        &public_inputs.inputs_commitment,
        &public_inputs.declared_doc_hash,
        &public_inputs.document_digest,
        &public_inputs.document_commitment,
    ] {
        decode_digest_hex(digest)?;
    }

    let expected_commitment = recompute_document_commitment(public_inputs)?;
    if expected_commitment != public_inputs.document_commitment {
        return Err("document commitment mismatch".to_string());
    }

    Ok(())
}

fn padded_block_words(document_bytes: &[u8]) -> Result<Vec<[BlockWord; 16]>, String> {
    if document_bytes.len() > MAX_CANONICAL_DOCUMENT_BYTES {
        return Err(format!(
            "canonical document bytes exceed max size of {MAX_CANONICAL_DOCUMENT_BYTES}"
        ));
    }

    let mut padded = document_bytes.to_vec();
    let bit_length = (padded.len() as u64) * 8;
    padded.push(0x80);
    while (padded.len() + 8) % 64 != 0 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_length.to_be_bytes());

    padded
        .chunks_exact(64)
        .map(|block| {
            let mut words = [BlockWord::default(); 16];
            for (index, chunk) in block.chunks_exact(4).enumerate() {
                words[index] = BlockWord(Value::known(u32::from_be_bytes(
                    chunk.try_into().expect("chunk length is fixed"),
                )));
            }
            Ok(words)
        })
        .collect()
}

fn default_setup_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("keys")
}

fn setup_dir() -> PathBuf {
    std::env::var_os("TRUSTSIGNAL_ZKP_SETUP_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(default_setup_dir)
}

fn params_path() -> PathBuf {
    setup_dir().join(PARAMS_FILE_NAME)
}

fn setup_manifest_path() -> PathBuf {
    setup_dir().join(SETUP_MANIFEST_FILE_NAME)
}

fn write_setup_manifest(path: &Path, verification_key_id: &str) -> Result<(), String> {
    let manifest = SetupManifest {
        circuit_id: ATTESTATION_CIRCUIT_ID.to_string(),
        params_k: ATTESTATION_K,
        max_canonical_document_bytes: MAX_CANONICAL_DOCUMENT_BYTES,
        verification_key_id: verification_key_id.to_string(),
    };
    let writer = BufWriter::new(File::create(path).map_err(|error| error.to_string())?);
    serde_json::to_writer_pretty(writer, &manifest).map_err(|error| error.to_string())
}

fn load_or_create_params(path: &Path) -> Result<Params<EqAffine>, String> {
    if path.exists() {
        let reader = File::open(path).map_err(|error| error.to_string())?;
        return Params::read::<_>(&mut BufReader::new(reader)).map_err(|error| error.to_string());
    }

    let params = Params::<EqAffine>::new(ATTESTATION_K);
    let writer = File::create(path).map_err(|error| error.to_string())?;
    params
        .write(&mut BufWriter::new(writer))
        .map_err(|error| error.to_string())?;
    Ok(params)
}

fn build_document_setup() -> Result<DocumentSetup, String> {
    let setup_dir = setup_dir();
    fs::create_dir_all(&setup_dir).map_err(|error| error.to_string())?;
    let params = load_or_create_params(&params_path())?;
    let empty = DocumentHashCircuit::default();
    let vk = keygen_vk(&params, &empty).map_err(|error| error.to_string())?;
    let pk = keygen_pk(&params, vk, &empty).map_err(|error| error.to_string())?;
    let verification_key_id = digest_hex(format!("{:?}", pk.get_vk().pinned()).as_bytes());

    let manifest_path = setup_manifest_path();
    if manifest_path.exists() {
        let reader = BufReader::new(File::open(&manifest_path).map_err(|error| error.to_string())?);
        let manifest: SetupManifest =
            serde_json::from_reader(reader).map_err(|error| error.to_string())?;
        if manifest.circuit_id != ATTESTATION_CIRCUIT_ID
            || manifest.params_k != ATTESTATION_K
            || manifest.max_canonical_document_bytes != MAX_CANONICAL_DOCUMENT_BYTES
            || manifest.verification_key_id != verification_key_id
        {
            return Err("setup manifest does not match current attestation circuit".to_string());
        }
    } else {
        write_setup_manifest(&manifest_path, &verification_key_id)?;
    }

    Ok(DocumentSetup {
        params,
        pk,
        verification_key_id,
    })
}

fn document_setup() -> Result<&'static DocumentSetup, String> {
    match DOCUMENT_SETUP.get_or_init(build_document_setup) {
        Ok(setup) => Ok(setup),
        Err(error) => Err(error.clone()),
    }
}

pub fn generate_attestation_proof(
    public_inputs: &AttestationPublicInputs,
    canonical_document_base64: &str,
) -> Result<Halo2Attestation, String> {
    validate_public_inputs(public_inputs)?;
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let canonical_document_bytes = STANDARD
        .decode(canonical_document_base64.as_bytes())
        .map_err(|error| error.to_string())?;
    if canonical_document_bytes.len() > MAX_CANONICAL_DOCUMENT_BYTES {
        return Err(format!(
            "canonical document bytes exceed max size of {MAX_CANONICAL_DOCUMENT_BYTES}"
        ));
    }

    let expected_digest = digest_hex(&canonical_document_bytes);
    if expected_digest != public_inputs.document_digest {
        return Err("document digest mismatch".to_string());
    }

    let setup = document_setup()?;
    let instance_values = vec![digest_words(&public_inputs.document_digest)?];
    let circuit = DocumentHashCircuit {
        canonical_document_bytes,
    };

    let mut transcript = Blake2bWrite::<Vec<u8>, EqAffine, Challenge255<EqAffine>>::init(vec![]);
    create_proof(
        &setup.params,
        &setup.pk,
        &[circuit],
        &[&[&instance_values[0][..]]],
        OsRng,
        &mut transcript,
    )
    .map_err(|error| error.to_string())?;
    let proof = transcript.finalize();

    let proof_artifact = Halo2ProofArtifact {
        format: ATTESTATION_FORMAT.to_string(),
        digest: digest_hex(&proof),
        encoding: ATTESTATION_ENCODING.to_string(),
        proof: STANDARD.encode(proof),
    };

    verify_attestation_proof(public_inputs, &proof_artifact, &setup.verification_key_id)?;

    Ok(Halo2Attestation {
        circuit_id: ATTESTATION_CIRCUIT_ID.to_string(),
        verification_key_id: setup.verification_key_id.clone(),
        proof_artifact,
    })
}

pub fn verify_attestation_proof(
    public_inputs: &AttestationPublicInputs,
    proof_artifact: &Halo2ProofArtifact,
    verification_key_id: &str,
) -> Result<(), String> {
    validate_public_inputs(public_inputs)?;
    if proof_artifact.format != ATTESTATION_FORMAT {
        return Err("unsupported proof artifact format".to_string());
    }
    if proof_artifact.encoding != ATTESTATION_ENCODING {
        return Err("unsupported proof artifact encoding".to_string());
    }

    let setup = document_setup()?;
    if setup.verification_key_id != verification_key_id {
        return Err("verification key id mismatch".to_string());
    }

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let proof = STANDARD
        .decode(proof_artifact.proof.as_bytes())
        .map_err(|error| error.to_string())?;
    if digest_hex(&proof) != proof_artifact.digest {
        return Err("proof digest mismatch".to_string());
    }

    let instance_values = vec![digest_words(&public_inputs.document_digest)?];
    let strategy = SingleVerifier::new(&setup.params);
    let mut transcript = Blake2bRead::<_, EqAffine, Challenge255<EqAffine>>::init(&proof[..]);
    verify_proof(
        &setup.params,
        setup.pk.get_vk(),
        strategy,
        &[&[&instance_values[0][..]]],
        &mut transcript,
    )
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        digest_hex, generate_attestation_proof, recompute_document_commitment,
        verify_attestation_proof, AttestationPublicInputs, Halo2ProofArtifact,
        ATTESTATION_SCHEMA_VERSION, ATTESTATION_WITNESS_MODE,
    };

    fn sample_public_inputs(document_bytes: &[u8]) -> AttestationPublicInputs {
        let document_digest = digest_hex(document_bytes);
        let mut public_inputs = AttestationPublicInputs {
            policy_hash: digest_hex(b"policy"),
            timestamp: "2026-03-07T00:00:00.000Z".to_string(),
            inputs_commitment: digest_hex(b"inputs"),
            conformance: true,
            declared_doc_hash: digest_hex(b"declared-doc-hash"),
            document_digest,
            document_commitment: String::new(),
            schema_version: ATTESTATION_SCHEMA_VERSION.to_string(),
            document_witness_mode: ATTESTATION_WITNESS_MODE.to_string(),
        };
        public_inputs.document_commitment =
            recompute_document_commitment(&public_inputs).expect("commitment should compute");
        public_inputs
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release prover service"]
    fn document_hash_round_trip_verifies() {
        let document_bytes = b"%PDF-1.4\nsample";
        let public_inputs = sample_public_inputs(document_bytes);
        let witness = {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            STANDARD.encode(document_bytes)
        };

        let attestation =
            generate_attestation_proof(&public_inputs, &witness).expect("proof generation should succeed");
        verify_attestation_proof(
            &public_inputs,
            &attestation.proof_artifact,
            &attestation.verification_key_id,
        )
        .expect("proof verification should succeed");
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release prover service"]
    fn tampered_document_digest_fails_generation() {
        let document_bytes = b"%PDF-1.4\nsample";
        let mut public_inputs = sample_public_inputs(document_bytes);
        public_inputs.document_digest = digest_hex(b"%PDF-1.4\ntampered");
        public_inputs.document_commitment =
            recompute_document_commitment(&public_inputs).expect("commitment should compute");
        let witness = {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            STANDARD.encode(document_bytes)
        };

        let error = generate_attestation_proof(&public_inputs, &witness)
            .expect_err("mismatched digest should fail");
        assert_eq!(error, "document digest mismatch");
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release prover service"]
    fn tampered_document_commitment_fails_verification() {
        let document_bytes = b"%PDF-1.4\nsample";
        let public_inputs = sample_public_inputs(document_bytes);
        let witness = {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            STANDARD.encode(document_bytes)
        };
        let attestation =
            generate_attestation_proof(&public_inputs, &witness).expect("proof generation should succeed");
        let tampered_inputs = AttestationPublicInputs {
            document_commitment: digest_hex(b"tampered-commitment"),
            ..public_inputs
        };

        let error = verify_attestation_proof(
            &tampered_inputs,
            &attestation.proof_artifact,
            &attestation.verification_key_id,
        )
        .expect_err("tampered commitment should fail verification");
        assert_eq!(error, "document commitment mismatch");
    }

    #[test]
    #[ignore = "slow cryptographic proof in debug mode; validate via release prover service"]
    fn tampered_proof_digest_fails_verification() {
        let document_bytes = b"%PDF-1.4\nsample";
        let public_inputs = sample_public_inputs(document_bytes);
        let witness = {
            use base64::{engine::general_purpose::STANDARD, Engine as _};
            STANDARD.encode(document_bytes)
        };
        let attestation =
            generate_attestation_proof(&public_inputs, &witness).expect("proof generation should succeed");
        let tampered_artifact = Halo2ProofArtifact {
            digest: digest_hex(b"tampered-proof"),
            ..attestation.proof_artifact
        };

        let error = verify_attestation_proof(
            &public_inputs,
            &tampered_artifact,
            &attestation.verification_key_id,
        )
        .expect_err("tampered proof digest should fail verification");
        assert_eq!(error, "proof digest mismatch");
    }
}
