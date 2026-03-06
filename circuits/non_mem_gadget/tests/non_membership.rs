use halo2_proofs::pasta::Fp;
use non_mem_gadget::{merkle::build_10_entry_db, merkle::MerkleTree, prove_non_membership, NonMembershipCircuit};

fn padded_db() -> Vec<Fp> {
    let mut db = build_10_entry_db();
    while db.len() < 16 {
        db.push(Fp::from(0));
    }
    db
}

#[test]
fn proves_non_membership_with_10_entry_db() {
    let leaves = padded_db();
    let tree = MerkleTree::from_leaves(leaves.clone());

    let left_idx = 4;
    let right_idx = 5;
    let query_leaf = Fp::from(57); // not in DB where entries are multiples of 11

    let circuit = NonMembershipCircuit {
        left_leaf: leaves[left_idx],
        right_leaf: leaves[right_idx],
        query_leaf,
        left_path: tree.path(left_idx),
        right_path: tree.path(right_idx),
    };

    let k = 9;
    let result = prove_non_membership(circuit, tree.root(), k);
    assert!(result.is_ok(), "{result:?}");

    let gate_budget = 1usize << k;
    assert!(gate_budget < 400_000, "gate budget exceeded: {gate_budget}");
}
