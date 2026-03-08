# TrustSignal Notebooks

This folder contains versioned experimental notebooks for R&D and QA across TrustSignal verification layers.

## Notebook Index

- `trustsignal-ezkl-experiments.ipynb`
  - Purpose: zkML circuit calibration and proof benchmarking.
  - Track: model input/output shapes, `ezkl.calibrate_settings()` output per vertical, proof-time vs quality, witness size, and SRS params.

- `trustsignal-signal-accuracy.ipynb`
  - Purpose: pre-proof signal extraction QA by vertical.
  - Track: precision/recall, false-positive rate by document category, and threshold tuning decisions.

- `registry-wave1-primary-source-expansion-2026-03-07.ipynb`
  - Purpose: change log and validation evidence for registry adapter Wave 1 expansion.
  - Track: source additions, security guardrails, validation commands, and control-to-artifact mapping for compliance review.
  - Export artifact: `notebooks/artifacts/vanta-controls-registry-wave1-2026-03-07.csv`

- `vanta-evidence-master.ipynb`
  - Purpose: repo-level evidence index for Vanta-aligned controls across security, API, operations, and governance workstreams.
  - Track: 90-day git timeline, control matrix status (`READY`/`IN_PROGRESS`/`GAP`), evidence paths, and open task gaps.
  - Export artifact: `notebooks/artifacts/vanta-controls-master-2026-03-07.csv`

- `governance-ci-unblock-2026-03-07.ipynb`
  - Purpose: evidence trail for GitHub governance hardening and CI required-check unblock remediation.
  - Track: workflow remediation actions, lazy EZKL loading fix rationale, validation command outcomes, and session control mapping.
  - Export artifact: `notebooks/artifacts/vanta-controls-ci-unblock-2026-03-07.csv`

## Session Workflow (Required)

1. Pull latest `work` branch before edits.
2. Add a new run block in the relevant notebook (do not overwrite prior run history).
3. Record date/time (UTC), vertical, and dataset/model version in the run.
4. Capture key metrics and final recommendation for that run.
5. Save notebook with outputs trimmed to essentials (no huge dumps).
6. Commit notebook updates in the same PR as related code/config changes.

## Reproducibility Standard

- Keep cells small and top-to-bottom runnable.
- Put all run configuration near the top of each notebook.
- Persist machine-readable snapshots under:
  - `notebooks/artifacts/ezkl/` for EZKL runs
  - `notebooks/artifacts/` for compliance/control export snapshots
  - `notebooks/data/` for local evaluation datasets
- Prefer deterministic seeds for synthetic or sampled experiments.

## Security and Data Handling

- Do not commit secrets, API keys, or private endpoints.
- Do not include raw PII in notebook outputs.
- Use redacted/synthetic data when sharing publicly.
- If production-like data is required, document approval and masking approach in markdown cells.

## Local Execution

From repo root:

```bash
uv pip install jupyterlab ipykernel
jupyter lab
```

Open notebooks from `notebooks/` and run top-to-bottom.

## Naming and New Notebooks

- Keep filenames stable and descriptive.
- Use lowercase with hyphens (for example, `vertical-risk-ablation.ipynb`).
- Add any new notebook to the index above with:
  - purpose
  - required metrics
  - owner/team

## PR Expectations

- Every notebook-changing PR should include a short summary:
  - what changed
  - key metric deltas
  - decision taken (promote, hold, or revert)
