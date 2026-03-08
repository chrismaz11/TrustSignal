pub mod attestation;
pub mod merkle;
pub mod revocation;

use halo2_proofs::{
    arithmetic::Field,
    circuit::{Layouter, SimpleFloorPlanner, Value},
    dev::MockProver,
    pasta::Fp,
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Instance, Selector},
    poly::Rotation,
};
use std::time::Instant;

use merkle::{MerklePath, NON_MEM_DOMAIN_TAG};
use revocation::{
    synthesize_revocation_witness, validate_nullifier, RevocationConfig, RevocationError,
    RevocationWitness,
};

#[derive(Clone, Debug)]
pub struct NonMembershipConfig {
    left: Column<Advice>,
    right: Column<Advice>,
    parent: Column<Advice>,
    node: Column<Advice>,
    inv: Column<Advice>,
    query: Column<Advice>,
    sel_hash: Selector,
    sel_nonzero: Selector,
    instance: Column<Instance>,
}

impl NonMembershipConfig {
    fn configure(meta: &mut ConstraintSystem<Fp>, instance: Column<Instance>) -> Self {
        let left = meta.advice_column();
        let right = meta.advice_column();
        let parent = meta.advice_column();
        let node = meta.advice_column();
        let inv = meta.advice_column();
        let query = meta.advice_column();

        meta.enable_equality(parent);
        meta.enable_equality(node);
        meta.enable_equality(instance);

        let sel_hash = meta.selector();
        meta.create_gate("toy hash gate", |meta| {
            let s = meta.query_selector(sel_hash);
            let l = meta.query_advice(left, Rotation::cur());
            let r = meta.query_advice(right, Rotation::cur());
            let p = meta.query_advice(parent, Rotation::cur());
            vec![
                s * (l * halo2_proofs::plonk::Expression::Constant(Fp::from(7))
                    + r * halo2_proofs::plonk::Expression::Constant(Fp::from(13))
                    + halo2_proofs::plonk::Expression::Constant(Fp::from(NON_MEM_DOMAIN_TAG))
                    - p),
            ]
        });

        let sel_nonzero = meta.selector();
        meta.create_gate("non-zero via inverse", |meta| {
            let s = meta.query_selector(sel_nonzero);
            let n = meta.query_advice(node, Rotation::cur());
            let i = meta.query_advice(inv, Rotation::cur());
            vec![s * (n * i - halo2_proofs::plonk::Expression::Constant(Fp::one()))]
        });

        Self {
            left,
            right,
            parent,
            node,
            inv,
            query,
            sel_hash,
            sel_nonzero,
            instance,
        }
    }
}

#[derive(Clone, Debug)]
pub struct NonMembershipCircuit {
    pub left_leaf: Fp,
    pub right_leaf: Fp,
    pub query_leaf: Fp,
    pub left_path: MerklePath,
    pub right_path: MerklePath,
}

impl NonMembershipCircuit {
    fn hash2(a: Fp, b: Fp) -> Fp {
        a * Fp::from(7) + b * Fp::from(13) + Fp::from(NON_MEM_DOMAIN_TAG)
    }

    fn synthesize_non_membership(
        &self,
        cfg: &NonMembershipConfig,
        mut layouter: impl Layouter<Fp>,
        root_instance: usize,
    ) -> Result<(), Error> {
        let left_root_cell = layouter.assign_region(
            || "left membership and non-equality",
            |mut region| {
                let mut cur = self.left_leaf;
                let q = self.query_leaf;

                region.assign_advice(|| "node diff", cfg.node, 0, || Value::known(cur - q))?;
                region.assign_advice(
                    || "node diff inv",
                    cfg.inv,
                    0,
                    || Value::known((cur - q).invert().unwrap_or(Fp::zero())),
                )?;
                cfg.sel_nonzero.enable(&mut region, 0)?;

                let mut offset = 1;
                for sibling in &self.left_path.siblings {
                    let (l, r) = if sibling.is_left {
                        (sibling.value, cur)
                    } else {
                        (cur, sibling.value)
                    };
                    let p = Self::hash2(l, r);

                    region.assign_advice(|| "left", cfg.left, offset, || Value::known(l))?;
                    region.assign_advice(|| "right", cfg.right, offset, || Value::known(r))?;
                    let parent_cell = region.assign_advice(
                        || "parent",
                        cfg.parent,
                        offset,
                        || Value::known(p),
                    )?;
                    cfg.sel_hash.enable(&mut region, offset)?;

                    cur = p;
                    if offset + 1 < self.left_path.siblings.len() + 1 {
                        region.assign_advice(
                            || "rolling node",
                            cfg.node,
                            offset + 1,
                            || Value::known(cur),
                        )?;
                    }
                    if offset == self.left_path.siblings.len() {
                        return Ok(parent_cell);
                    }
                    offset += 1;
                }

                unreachable!("left path must have at least one sibling")
            },
        )?;

        let right_root_cell = layouter.assign_region(
            || "right membership and non-equality",
            |mut region| {
                let mut cur = self.right_leaf;
                let q = self.query_leaf;

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
                for sibling in &self.right_path.siblings {
                    let (l, r) = if sibling.is_left {
                        (sibling.value, cur)
                    } else {
                        (cur, sibling.value)
                    };
                    let p = Self::hash2(l, r);

                    region.assign_advice(|| "left", cfg.left, offset, || Value::known(l))?;
                    region.assign_advice(|| "right", cfg.right, offset, || Value::known(r))?;
                    let parent_cell = region.assign_advice(
                        || "parent",
                        cfg.parent,
                        offset,
                        || Value::known(p),
                    )?;
                    cfg.sel_hash.enable(&mut region, offset)?;

                    cur = p;
                    if offset == self.right_path.siblings.len() {
                        return Ok(parent_cell);
                    }
                    offset += 1;
                }

                unreachable!("right path must have at least one sibling")
            },
        )?;

        layouter.constrain_instance(left_root_cell.cell(), cfg.instance, root_instance)?;
        layouter.constrain_instance(right_root_cell.cell(), cfg.instance, root_instance)?;
        Ok(())
    }
}

impl Circuit<Fp> for NonMembershipCircuit {
    type Config = NonMembershipConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            left_leaf: Fp::zero(),
            right_leaf: Fp::zero(),
            query_leaf: Fp::zero(),
            left_path: self.left_path.empty_like(),
            right_path: self.right_path.empty_like(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let instance = meta.instance_column();
        NonMembershipConfig::configure(meta, instance)
    }

    fn synthesize(&self, cfg: Self::Config, layouter: impl Layouter<Fp>) -> Result<(), Error> {
        self.synthesize_non_membership(&cfg, layouter, 0)
    }
}

pub fn prove_non_membership(circuit: NonMembershipCircuit, root: Fp, k: u32) -> Result<(), String> {
    let prover = MockProver::run(k, &circuit, vec![vec![root]]).map_err(|e| e.to_string())?;
    prover
        .verify()
        .map_err(|errs| format!("proof failed: {errs:?}"))
}

#[derive(Clone, Debug)]
pub struct CombinedConfig {
    non_membership: NonMembershipConfig,
    revocation: RevocationConfig,
}

#[derive(Clone, Debug)]
pub struct CombinedCircuit {
    pub non_membership: NonMembershipCircuit,
    pub revocation: RevocationWitness,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CombinedProofError {
    Revocation(RevocationError),
    ProofFailed(String),
}

impl From<RevocationError> for CombinedProofError {
    fn from(value: RevocationError) -> Self {
        Self::Revocation(value)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CombinedProofResult {
    pub k: u32,
    pub gate_count: usize,
    pub proof_gen_ms: u128,
}

impl Circuit<Fp> for CombinedCircuit {
    type Config = CombinedConfig;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self {
        Self {
            non_membership: NonMembershipCircuit {
                left_leaf: Fp::zero(),
                right_leaf: Fp::zero(),
                query_leaf: Fp::zero(),
                left_path: self.non_membership.left_path.empty_like(),
                right_path: self.non_membership.right_path.empty_like(),
            },
            revocation: self.revocation.empty_like(),
        }
    }

    fn configure(meta: &mut ConstraintSystem<Fp>) -> Self::Config {
        let instance = meta.instance_column();
        let non_membership = NonMembershipConfig::configure(meta, instance);
        let revocation = RevocationConfig::configure(meta, instance);
        CombinedConfig {
            non_membership,
            revocation,
        }
    }

    fn synthesize(&self, cfg: Self::Config, mut layouter: impl Layouter<Fp>) -> Result<(), Error> {
        self.non_membership.synthesize_non_membership(
            &cfg.non_membership,
            layouter.namespace(|| "non-membership"),
            0,
        )?;
        synthesize_revocation_witness(
            &self.revocation,
            &cfg.revocation,
            layouter.namespace(|| "revocation"),
            1,
        )?;
        Ok(())
    }
}

pub fn prove_and_verify(
    circuit: CombinedCircuit,
    non_membership_root: Fp,
    revocation_root: Fp,
    k: u32,
) -> Result<CombinedProofResult, CombinedProofError> {
    validate_nullifier(&circuit.revocation)?;

    let started_at = Instant::now();
    let prover = MockProver::run(
        k,
        &circuit,
        vec![vec![non_membership_root, revocation_root]],
    )
    .map_err(|e| CombinedProofError::ProofFailed(e.to_string()))?;

    prover.verify().map_err(|errs| {
        CombinedProofError::ProofFailed(format!("combined proof failed: {errs:?}"))
    })?;

    Ok(CombinedProofResult {
        k,
        gate_count: 1usize << k,
        proof_gen_ms: started_at.elapsed().as_millis(),
    })
}
