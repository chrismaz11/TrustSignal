use crate::merkle::{MerklePath, NON_MEM_DOMAIN_TAG};
use halo2_poseidon::{ConstantLength, Hash, P128Pow5T3};
use halo2_proofs::{
    arithmetic::Field,
    circuit::{Layouter, SimpleFloorPlanner, Value},
    dev::MockProver,
    pasta::Fp,
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Instance, Selector},
    poly::Rotation,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RevocationError {
    NullifierSpent,
    NullifierInvalid,
}

#[derive(Clone, Debug)]
pub struct RevocationWitness {
    pub deed_hash: Fp,
    pub secret: Fp,
    pub nullifier: Fp,
    pub left_leaf: Fp,
    pub right_leaf: Fp,
    pub left_path: MerklePath,
    pub right_path: MerklePath,
}

impl RevocationWitness {
    pub fn empty_like(&self) -> Self {
        Self {
            deed_hash: Fp::zero(),
            secret: Fp::zero(),
            nullifier: Fp::zero(),
            left_leaf: Fp::zero(),
            right_leaf: Fp::zero(),
            left_path: self.left_path.empty_like(),
            right_path: self.right_path.empty_like(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct RevocationConfig {
    left: Column<Advice>,
    right: Column<Advice>,
    parent: Column<Advice>,
    node: Column<Advice>,
    inv: Column<Advice>,
    query: Column<Advice>,
    deed_hash: Column<Advice>,
    secret: Column<Advice>,
    nullifier: Column<Advice>,
    expected_nullifier: Column<Advice>,
    sel_hash: Selector,
    sel_nonzero: Selector,
    sel_nullifier_match: Selector,
    instance: Column<Instance>,
}

impl RevocationConfig {
    pub fn configure(meta: &mut ConstraintSystem<Fp>, instance: Column<Instance>) -> Self {
        let left = meta.advice_column();
        let right = meta.advice_column();
        let parent = meta.advice_column();
        let node = meta.advice_column();
        let inv = meta.advice_column();
        let query = meta.advice_column();
        let deed_hash = meta.advice_column();
        let secret = meta.advice_column();
        let nullifier = meta.advice_column();
        let expected_nullifier = meta.advice_column();

        meta.enable_equality(parent);
        meta.enable_equality(node);
        meta.enable_equality(instance);

        let sel_hash = meta.selector();
        meta.create_gate("revocation merkle hash gate", |meta| {
            let s = meta.query_selector(sel_hash);
            let l = meta.query_advice(left, Rotation::cur());
            let r = meta.query_advice(right, Rotation::cur());
            let p = meta.query_advice(parent, Rotation::cur());
            vec![s
                * (l * halo2_proofs::plonk::Expression::Constant(Fp::from(7))
                    + r * halo2_proofs::plonk::Expression::Constant(Fp::from(13))
                    + halo2_proofs::plonk::Expression::Constant(Fp::from(NON_MEM_DOMAIN_TAG))
                    - p)]
        });

        let sel_nonzero = meta.selector();
        meta.create_gate("revocation non-zero via inverse", |meta| {
            let s = meta.query_selector(sel_nonzero);
            let n = meta.query_advice(node, Rotation::cur());
            let i = meta.query_advice(inv, Rotation::cur());
            vec![s * (n * i - halo2_proofs::plonk::Expression::Constant(Fp::one()))]
        });

        let sel_nullifier_match = meta.selector();
        meta.create_gate("nullifier matches poseidon hash", |meta| {
            let s = meta.query_selector(sel_nullifier_match);
            let expected = meta.query_advice(expected_nullifier, Rotation::cur());
            let n = meta.query_advice(nullifier, Rotation::cur());
            vec![s * (expected - n)]
        });

        Self {
            left,
            right,
            parent,
            node,
            inv,
            query,
            deed_hash,
            secret,
            nullifier,
            expected_nullifier,
            sel_hash,
            sel_nonzero,
            sel_nullifier_match,
            instance,
        }
    }
}

#[derive(Clone, Debug)]
pub struct RevocationCircuit {
    pub witness: RevocationWitness,
}

impl Circuit<Fp> for RevocationCircuit {
    type Config = RevocationConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            witness: self.witness.empty_like(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let instance = meta.instance_column();
        RevocationConfig::configure(meta, instance)
    }

    fn synthesize(&self, cfg: Self::Config, layouter: impl Layouter<Fp>) -> Result<(), Error> {
        synthesize_revocation_witness(&self.witness, &cfg, layouter, 0)
    }
}

pub fn poseidon_nullifier_hash(deed_hash: Fp, secret: Fp) -> Fp {
    let hasher = Hash::<Fp, P128Pow5T3, ConstantLength<2>, 3, 2>::init();
    hasher.hash([deed_hash, secret])
}

pub fn validate_nullifier(witness: &RevocationWitness) -> Result<(), RevocationError> {
    let expected = poseidon_nullifier_hash(witness.deed_hash, witness.secret);
    if witness.nullifier != expected {
        return Err(RevocationError::NullifierInvalid);
    }

    if witness.nullifier == witness.left_leaf || witness.nullifier == witness.right_leaf {
        return Err(RevocationError::NullifierSpent);
    }

    Ok(())
}

pub fn synthesize_revocation_witness(
    witness: &RevocationWitness,
    cfg: &RevocationConfig,
    mut layouter: impl Layouter<Fp>,
    root_instance: usize,
) -> Result<(), Error> {
    let expected_nullifier = poseidon_nullifier_hash(witness.deed_hash, witness.secret);

    layouter.assign_region(
        || "nullifier derivation",
        |mut region| {
            region.assign_advice(|| "deed_hash", cfg.deed_hash, 0, || Value::known(witness.deed_hash))?;
            region.assign_advice(|| "secret", cfg.secret, 0, || Value::known(witness.secret))?;
            region.assign_advice(|| "nullifier", cfg.nullifier, 0, || Value::known(witness.nullifier))?;
            region.assign_advice(
                || "expected_nullifier",
                cfg.expected_nullifier,
                0,
                || Value::known(expected_nullifier),
            )?;
            cfg.sel_nullifier_match.enable(&mut region, 0)?;
            Ok(())
        },
    )?;

    let left_root_cell = layouter.assign_region(
        || "revocation left membership and non-equality",
        |mut region| {
            let mut cur = witness.left_leaf;
            let q = witness.nullifier;

            region.assign_advice(|| "query", cfg.query, 0, || Value::known(q))?;
            region.assign_advice(|| "node diff", cfg.node, 0, || Value::known(cur - q))?;
            region.assign_advice(
                || "node diff inv",
                cfg.inv,
                0,
                || Value::known((cur - q).invert().unwrap_or(Fp::zero())),
            )?;
            cfg.sel_nonzero.enable(&mut region, 0)?;

            let mut offset = 1;
            for sibling in &witness.left_path.siblings {
                let (l, r) = if sibling.is_left {
                    (sibling.value, cur)
                } else {
                    (cur, sibling.value)
                };
                let p = l * Fp::from(7) + r * Fp::from(13) + Fp::from(NON_MEM_DOMAIN_TAG);

                region.assign_advice(|| "left", cfg.left, offset, || Value::known(l))?;
                region.assign_advice(|| "right", cfg.right, offset, || Value::known(r))?;
                let parent_cell = region.assign_advice(|| "parent", cfg.parent, offset, || Value::known(p))?;
                cfg.sel_hash.enable(&mut region, offset)?;

                cur = p;
                if offset == witness.left_path.siblings.len() {
                    return Ok(parent_cell);
                }
                offset += 1;
            }

            unreachable!("left revocation path must have at least one sibling")
        },
    )?;

    let right_root_cell = layouter.assign_region(
        || "revocation right membership and non-equality",
        |mut region| {
            let mut cur = witness.right_leaf;
            let q = witness.nullifier;

            region.assign_advice(|| "query", cfg.query, 0, || Value::known(q))?;
            region.assign_advice(|| "node diff", cfg.node, 0, || Value::known(cur - q))?;
            region.assign_advice(
                || "node diff inv",
                cfg.inv,
                0,
                || Value::known((cur - q).invert().unwrap_or(Fp::zero())),
            )?;
            cfg.sel_nonzero.enable(&mut region, 0)?;

            let mut offset = 1;
            for sibling in &witness.right_path.siblings {
                let (l, r) = if sibling.is_left {
                    (sibling.value, cur)
                } else {
                    (cur, sibling.value)
                };
                let p = l * Fp::from(7) + r * Fp::from(13) + Fp::from(NON_MEM_DOMAIN_TAG);

                region.assign_advice(|| "left", cfg.left, offset, || Value::known(l))?;
                region.assign_advice(|| "right", cfg.right, offset, || Value::known(r))?;
                let parent_cell = region.assign_advice(|| "parent", cfg.parent, offset, || Value::known(p))?;
                cfg.sel_hash.enable(&mut region, offset)?;

                cur = p;
                if offset == witness.right_path.siblings.len() {
                    return Ok(parent_cell);
                }
                offset += 1;
            }

            unreachable!("right revocation path must have at least one sibling")
        },
    )?;

    layouter.constrain_instance(left_root_cell.cell(), cfg.instance, root_instance)?;
    layouter.constrain_instance(right_root_cell.cell(), cfg.instance, root_instance)?;
    Ok(())
}

pub fn prove_revocation(circuit: RevocationCircuit, root: Fp, k: u32) -> Result<(), RevocationError> {
    validate_nullifier(&circuit.witness)?;

    let prover = MockProver::run(k, &circuit, vec![vec![root]]).map_err(|_| RevocationError::NullifierSpent)?;
    prover.verify().map_err(|_| RevocationError::NullifierSpent)
}
