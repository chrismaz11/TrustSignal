use halo2_proofs::pasta::Fp;
use non_mem_gadget::{
    merkle::MerkleTree,
    revocation::{
        poseidon_nullifier_hash, prove_revocation, RevocationCircuit, RevocationError,
        RevocationWitness,
    },
};

const LEFT_IDX: usize = 4;
const RIGHT_IDX: usize = 5;
const K: u32 = 10;

fn build_tree_with_boundaries(left_leaf: Fp, right_leaf: Fp) -> (MerkleTree, Vec<Fp>) {
    let mut leaves: Vec<Fp> = (1..=16).map(Fp::from).collect();
    leaves[LEFT_IDX] = left_leaf;
    leaves[RIGHT_IDX] = right_leaf;
    (MerkleTree::from_leaves(leaves.clone()), leaves)
}

fn build_witness(
    deed_hash: Fp,
    secret: Fp,
    nullifier: Fp,
    leaves: &[Fp],
    tree: &MerkleTree,
) -> RevocationWitness {
    RevocationWitness {
        deed_hash,
        secret,
        nullifier,
        left_leaf: leaves[LEFT_IDX],
        right_leaf: leaves[RIGHT_IDX],
        left_path: tree.path(LEFT_IDX),
        right_path: tree.path(RIGHT_IDX),
    }
}

#[test]
fn valid_nullifier_passes() {
    let deed_hash = Fp::from(1337);
    let secret = Fp::from(9001);
    let nullifier = poseidon_nullifier_hash(deed_hash, secret);

    let (tree, leaves) = build_tree_with_boundaries(Fp::from(77), Fp::from(88));
    let witness = build_witness(deed_hash, secret, nullifier, &leaves, &tree);

    let circuit = RevocationCircuit { witness };
    let result = prove_revocation(circuit, tree.root(), K);
    assert!(result.is_ok(), "{result:?}");
}

#[test]
fn spent_nullifier_fails() {
    let deed_hash = Fp::from(71);
    let secret = Fp::from(19);
    let nullifier = poseidon_nullifier_hash(deed_hash, secret);

    let (tree, leaves) = build_tree_with_boundaries(nullifier, Fp::from(808));
    let witness = build_witness(deed_hash, secret, nullifier, &leaves, &tree);

    let circuit = RevocationCircuit { witness };
    let result = prove_revocation(circuit, tree.root(), K);
    assert_eq!(result, Err(RevocationError::NullifierSpent));
}

#[test]
fn tampered_nullifier_fails() {
    let deed_hash = Fp::from(12);
    let secret = Fp::from(34);
    let expected = poseidon_nullifier_hash(deed_hash, secret);
    let tampered_nullifier = expected + Fp::one();

    let (tree, leaves) = build_tree_with_boundaries(Fp::from(501), Fp::from(777));
    let witness = build_witness(deed_hash, secret, tampered_nullifier, &leaves, &tree);

    let circuit = RevocationCircuit { witness };
    let result = prove_revocation(circuit, tree.root(), K);
    assert_eq!(result, Err(RevocationError::NullifierInvalid));
}

#[test]
fn empty_revocation_list_passes() {
    let deed_hash = Fp::from(5);
    let secret = Fp::from(42);
    let nullifier = poseidon_nullifier_hash(deed_hash, secret);

    let leaves = vec![Fp::zero(); 16];
    let tree = MerkleTree::from_leaves(leaves.clone());
    let witness = build_witness(deed_hash, secret, nullifier, &leaves, &tree);

    let circuit = RevocationCircuit { witness };
    let result = prove_revocation(circuit, tree.root(), K);
    assert!(result.is_ok(), "{result:?}");
}

#[test]
fn collision_attempt_fails() {
    let deed_hash_a = Fp::from(21);
    let secret_a = Fp::from(22);
    let nullifier_a = poseidon_nullifier_hash(deed_hash_a, secret_a);

    let deed_hash_b = Fp::from(23);
    let secret_b = Fp::from(24);
    assert_ne!(poseidon_nullifier_hash(deed_hash_b, secret_b), nullifier_a);

    let (tree, leaves) = build_tree_with_boundaries(Fp::from(320), Fp::from(321));
    let witness = build_witness(deed_hash_b, secret_b, nullifier_a, &leaves, &tree);

    let circuit = RevocationCircuit { witness };
    let result = prove_revocation(circuit, tree.root(), K);
    assert_eq!(result, Err(RevocationError::NullifierInvalid));
}
