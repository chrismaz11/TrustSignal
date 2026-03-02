use halo2_proofs::pasta::Fp;

pub const NON_MEM_DOMAIN_TAG: u64 = 97;

#[derive(Clone, Debug)]
pub struct PathNode {
    pub value: Fp,
    pub is_left: bool,
}

#[derive(Clone, Debug)]
pub struct MerklePath {
    pub siblings: Vec<PathNode>,
}

impl MerklePath {
    pub fn empty_like(&self) -> Self {
        Self {
            siblings: self
                .siblings
                .iter()
                .map(|_| PathNode {
                    value: Fp::zero(),
                    is_left: false,
                })
                .collect(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct MerkleTree {
    levels: Vec<Vec<Fp>>,
}

impl MerkleTree {
    pub fn hash2(a: Fp, b: Fp) -> Fp {
        a * Fp::from(7) + b * Fp::from(13) + Fp::from(NON_MEM_DOMAIN_TAG)
    }

    pub fn from_leaves(mut leaves: Vec<Fp>) -> Self {
        assert!(leaves.len().is_power_of_two(), "leaf count must be power of two");
        let mut levels = vec![leaves.clone()];
        while leaves.len() > 1 {
            let next: Vec<Fp> = leaves
                .chunks_exact(2)
                .map(|pair| Self::hash2(pair[0], pair[1]))
                .collect();
            levels.push(next.clone());
            leaves = next;
        }
        Self { levels }
    }

    pub fn root(&self) -> Fp {
        self.levels.last().expect("levels")[0]
    }

    pub fn path(&self, leaf_index: usize) -> MerklePath {
        let mut idx = leaf_index;
        let mut siblings = Vec::with_capacity(self.levels.len() - 1);
        for level in &self.levels[..self.levels.len() - 1] {
            let sib_idx = if idx.is_multiple_of(2) { idx + 1 } else { idx - 1 };
            let is_left = sib_idx < idx;
            siblings.push(PathNode {
                value: level[sib_idx],
                is_left,
            });
            idx /= 2;
        }
        MerklePath { siblings }
    }
}

pub fn build_10_entry_db() -> Vec<Fp> {
    (1..=10).map(|v| Fp::from(v * 11)).collect()
}
