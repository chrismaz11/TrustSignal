use halo2_proofs::pasta::Fp;
use non_mem_gadget::{
    merkle::{build_10_entry_db, MerkleTree},
    prove_non_membership, NonMembershipCircuit,
    revocation::{poseidon_nullifier_hash, prove_revocation, RevocationCircuit, RevocationWitness},
};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::env;
use std::hash::{Hash, Hasher};
use std::time::Instant;

const K: u32 = 10;

#[derive(Clone, Debug)]
enum Mode {
    NonMem,
    Revocation,
}

#[derive(Serialize)]
struct VerifyOutput {
    mode: String,
    ok: bool,
    proof_gen_ms: u128,
    gate_count: usize,
    k: u32,
    error: Option<String>,
}

#[derive(Clone, Debug)]
struct CliArgs {
    mode: Mode,
    bundle_hash: String,
    tampered: bool,
    revoked: bool,
}

fn parse_args() -> Result<CliArgs, String> {
    let mut mode = Mode::NonMem;
    let mut bundle_hash = String::new();
    let mut tampered = false;
    let mut revoked = false;

    let mut iter = env::args().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--mode" => {
                let value = iter.next().ok_or("missing value for --mode")?;
                mode = match value.as_str() {
                    "non-mem" => Mode::NonMem,
                    "revocation" => Mode::Revocation,
                    other => return Err(format!("unsupported mode: {other}")),
                };
            }
            "--bundle-hash" => {
                bundle_hash = iter.next().ok_or("missing value for --bundle-hash")?;
            }
            "--tampered" => {
                tampered = true;
            }
            "--revoked" => {
                revoked = true;
            }
            other => return Err(format!("unexpected argument: {other}")),
        }
    }

    if bundle_hash.is_empty() {
        return Err(String::from("--bundle-hash is required"));
    }

    Ok(CliArgs {
        mode,
        bundle_hash,
        tampered,
        revoked,
    })
}

fn hash_bundle_to_u64(bundle_hash: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    bundle_hash.hash(&mut hasher);
    hasher.finish()
}

fn verify_non_membership(bundle_hash: &str, tampered: bool) -> VerifyOutput {
    let seed = hash_bundle_to_u64(bundle_hash);
    let mut leaves = build_10_entry_db();
    while leaves.len() < 16 {
        leaves.push(Fp::from(0));
    }

    let tree = MerkleTree::from_leaves(leaves.clone());
    let left_idx = 4usize;
    let right_idx = 5usize;

    let mut query_leaf = Fp::from((seed % 5000) + 57);
    if query_leaf == leaves[left_idx] || query_leaf == leaves[right_idx] {
        query_leaf += Fp::one();
    }
    if tampered {
        query_leaf = leaves[left_idx];
    }

    let circuit = NonMembershipCircuit {
        left_leaf: leaves[left_idx],
        right_leaf: leaves[right_idx],
        query_leaf,
        left_path: tree.path(left_idx),
        right_path: tree.path(right_idx),
    };

    let started_at = Instant::now();
    let result = prove_non_membership(circuit, tree.root(), K);
    let elapsed = started_at.elapsed().as_millis();

    match result {
        Ok(()) => VerifyOutput {
            mode: String::from("non-mem"),
            ok: true,
            proof_gen_ms: elapsed,
            gate_count: 1usize << K,
            k: K,
            error: None,
        },
        Err(error) => VerifyOutput {
            mode: String::from("non-mem"),
            ok: false,
            proof_gen_ms: elapsed,
            gate_count: 1usize << K,
            k: K,
            error: Some(error),
        },
    }
}

fn verify_revocation(bundle_hash: &str, revoked: bool) -> VerifyOutput {
    let seed = hash_bundle_to_u64(bundle_hash);
    let deed_hash = Fp::from((seed % 50_000) + 1_337);
    let secret = Fp::from(((seed >> 16) % 50_000) + 9_001);
    let nullifier = poseidon_nullifier_hash(deed_hash, secret);

    let mut leaves: Vec<Fp> = (1..=16).map(|value| Fp::from((value as u64) * 100)).collect();
    let left_idx = 4usize;
    let right_idx = 5usize;

    if revoked {
        leaves[left_idx] = nullifier;
    } else {
        if leaves[left_idx] == nullifier {
            leaves[left_idx] += Fp::one();
        }
        if leaves[right_idx] == nullifier {
            leaves[right_idx] += Fp::one();
        }
    }

    let tree = MerkleTree::from_leaves(leaves.clone());
    let witness = RevocationWitness {
        deed_hash,
        secret,
        nullifier,
        left_leaf: leaves[left_idx],
        right_leaf: leaves[right_idx],
        left_path: tree.path(left_idx),
        right_path: tree.path(right_idx),
    };
    let circuit = RevocationCircuit { witness };

    let started_at = Instant::now();
    let result = prove_revocation(circuit, tree.root(), K);
    let elapsed = started_at.elapsed().as_millis();

    match result {
        Ok(()) => VerifyOutput {
            mode: String::from("revocation"),
            ok: true,
            proof_gen_ms: elapsed,
            gate_count: 1usize << K,
            k: K,
            error: None,
        },
        Err(error) => VerifyOutput {
            mode: String::from("revocation"),
            ok: false,
            proof_gen_ms: elapsed,
            gate_count: 1usize << K,
            k: K,
            error: Some(format!("{error:?}")),
        },
    }
}

fn main() {
    let args = match parse_args() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2);
        }
    };

    let output = match args.mode {
        Mode::NonMem => verify_non_membership(&args.bundle_hash, args.tampered),
        Mode::Revocation => verify_revocation(&args.bundle_hash, args.revoked),
    };

    match serde_json::to_string(&output) {
        Ok(serialized) => println!("{serialized}"),
        Err(error) => {
            eprintln!("failed to serialize output: {error}");
            std::process::exit(3);
        }
    }
}
