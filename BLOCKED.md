# BLOCKED

## What failed
Building the new native Rust circuit crate at `circuits/non_mem_gadget` fails when Cargo attempts to fetch:

- `halo2_proofs = { git = "https://github.com/privacy-scaling-explorations/halo2", tag = "v0.3.0" }`

All required commands fail for the same reason:

- `cargo build`
- `cargo test`
- `cargo bench --bench non_mem_bench`

## Why it failed
The environment cannot access GitHub over the configured network/proxy path:

- `CONNECT tunnel failed, response 403`

This prevents downloading the mandated halo2 dependency from the PSE repository, so compilation and bench execution cannot proceed.

## What is needed to continue
One of the following is required:

1. Network/proxy access that allows cloning `https://github.com/privacy-scaling-explorations/halo2`.
2. A vendored/local copy of the halo2 repository and a path dependency override in `Cargo.toml`.
3. An internal mirror of that repository reachable from this environment.

Once dependency resolution works, rerun:

```bash
cd circuits/non_mem_gadget
cargo build
cargo test
cargo bench --bench non_mem_bench
```

At that point `benches/bench_output.json` will be produced with the measured gate count and proof timing.
