use criterion::{criterion_group, criterion_main, Criterion};
use halo2_proofs::pasta::Fp;
use non_mem_gadget::{
    merkle::{build_10_entry_db, MerkleTree},
    prove_and_verify,
    revocation::{poseidon_nullifier_hash, RevocationWitness},
    CombinedCircuit, NonMembershipCircuit,
};
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
struct BenchOutput {
    k: u32,
    gate_count: usize,
    proof_gen_ms: u128,
}

fn build_combined_circuit() -> (CombinedCircuit, Fp, Fp) {
    let mut non_mem_leaves = build_10_entry_db();
    while non_mem_leaves.len() < 16 {
        non_mem_leaves.push(Fp::from(0));
    }
    let non_mem_tree = MerkleTree::from_leaves(non_mem_leaves.clone());
    let non_mem_left_idx = 4;
    let non_mem_right_idx = 5;

    let non_membership = NonMembershipCircuit {
        left_leaf: non_mem_leaves[non_mem_left_idx],
        right_leaf: non_mem_leaves[non_mem_right_idx],
        query_leaf: Fp::from(57),
        left_path: non_mem_tree.path(non_mem_left_idx),
        right_path: non_mem_tree.path(non_mem_right_idx),
    };

    let deed_hash = Fp::from(1_337);
    let secret = Fp::from(9_001);
    let nullifier = poseidon_nullifier_hash(deed_hash, secret);

    let mut revocation_leaves: Vec<Fp> = (1..=16).map(|v| Fp::from(v as u64 * 100)).collect();
    let revocation_left_idx = 4;
    let revocation_right_idx = 5;
    if revocation_leaves[revocation_left_idx] == nullifier {
        revocation_leaves[revocation_left_idx] += Fp::one();
    }
    if revocation_leaves[revocation_right_idx] == nullifier {
        revocation_leaves[revocation_right_idx] += Fp::one();
    }

    let revocation_tree = MerkleTree::from_leaves(revocation_leaves.clone());
    let revocation = RevocationWitness {
        deed_hash,
        secret,
        nullifier,
        left_leaf: revocation_leaves[revocation_left_idx],
        right_leaf: revocation_leaves[revocation_right_idx],
        left_path: revocation_tree.path(revocation_left_idx),
        right_path: revocation_tree.path(revocation_right_idx),
    };

    (
        CombinedCircuit {
            non_membership,
            revocation,
        },
        non_mem_tree.root(),
        revocation_tree.root(),
    )
}

fn bench_combined_proof(c: &mut Criterion) {
    let (circuit, non_membership_root, revocation_root) = build_combined_circuit();
    let k = 10;

    let result = prove_and_verify(circuit.clone(), non_membership_root, revocation_root, k)
        .expect("combined proof should verify");

    let output = BenchOutput {
        k,
        gate_count: result.gate_count,
        proof_gen_ms: result.proof_gen_ms,
    };

    let output_json = serde_json::to_string_pretty(&output).expect("serialize bench output");
    fs::write("benches/bench_output.json", output_json).expect("write bench output");

    c.bench_function("combined_non_mem_revocation_proof_gen", |b| {
        b.iter(|| {
            let (bench_circuit, bench_non_mem_root, bench_revocation_root) =
                build_combined_circuit();
            let _ = prove_and_verify(bench_circuit, bench_non_mem_root, bench_revocation_root, k)
                .expect("combined proof should verify");
        });
    });
}

criterion_group!(benches, bench_combined_proof);
criterion_main!(benches);
