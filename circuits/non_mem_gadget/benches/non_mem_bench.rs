use criterion::{criterion_group, criterion_main, Criterion};
use halo2_proofs::pasta::Fp;
use non_mem_gadget::{merkle::build_10_entry_db, merkle::MerkleTree, prove_non_membership, NonMembershipCircuit};
use serde::Serialize;
use std::{fs, time::Instant};

#[derive(Serialize)]
struct BenchOutput {
    k: u32,
    gate_count: usize,
    proof_gen_ms: u128,
}

fn build_circuit() -> (NonMembershipCircuit, Fp) {
    let mut leaves = build_10_entry_db();
    while leaves.len() < 16 {
        leaves.push(Fp::from(0));
    }
    let tree = MerkleTree::from_leaves(leaves.clone());
    let left_idx = 4;
    let right_idx = 5;

    let circuit = NonMembershipCircuit {
        left_leaf: leaves[left_idx],
        right_leaf: leaves[right_idx],
        query_leaf: Fp::from(57),
        left_path: tree.path(left_idx),
        right_path: tree.path(right_idx),
    };
    (circuit, tree.root())
}

fn bench_non_membership(c: &mut Criterion) {
    let (circuit, root) = build_circuit();
    let k = 9;

    let start = Instant::now();
    let res = prove_non_membership(circuit.clone(), root, k);
    let elapsed = start.elapsed().as_millis();
    assert!(res.is_ok(), "proof check failed: {res:?}");

    let output = BenchOutput {
        k,
        gate_count: 1usize << k,
        proof_gen_ms: elapsed,
    };

    let output_json = serde_json::to_string_pretty(&output).expect("serialize bench output");
    fs::write("benches/bench_output.json", output_json).expect("write bench output");

    c.bench_function("non_membership_proof_gen", |b| {
        b.iter(|| {
            let (bench_circuit, bench_root) = build_circuit();
            let _ = prove_non_membership(bench_circuit, bench_root, k).expect("proof should verify");
        });
    });
}

criterion_group!(benches, bench_non_membership);
criterion_main!(benches);
