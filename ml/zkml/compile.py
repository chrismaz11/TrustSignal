#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import inspect
import json
import sys
import time
from pathlib import Path

import ezkl
import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "ml" / "model"
DATA_DIR = ROOT / "ml" / "data"
ZKML_DIR = ROOT / "ml" / "zkml"

sys.path.insert(0, (MODEL_DIR).as_posix())
from common import DeedFraudCNN, build_feature_matrix, load_dataset  # noqa: E402


async def _resolve(value):
    if inspect.isawaitable(value):
        return await value
    return value


def _extract_logrows(settings: dict) -> int:
    candidates = [
        settings.get("run_args", {}).get("logrows"),
        settings.get("logrows"),
        settings.get("settings", {}).get("run_args", {}).get("logrows"),
    ]
    for candidate in candidates:
        if candidate is not None:
            return int(candidate)
    raise ValueError("unable to locate logrows in settings")


def _write_input_json(path: Path, samples: np.ndarray) -> None:
    flattened = samples.astype(np.float32).reshape(-1).tolist()
    payload = {"input_data": [flattened]}
    path.write_text(json.dumps(payload), encoding="utf-8")


async def main() -> None:
    onnx_path = MODEL_DIR / "deed_cnn.onnx"
    checkpoint_path = MODEL_DIR / "deed_cnn.pt"
    metrics_path = MODEL_DIR / "train_metrics.json"
    dataset_path = DATA_DIR / "deeds_dataset.csv"

    settings_path = ZKML_DIR / "settings.json"
    compiled_path = ZKML_DIR / "deed_cnn.compiled"
    calibration_path = ZKML_DIR / "calibration_data.json"
    srs_path = ZKML_DIR / "kzg.srs"
    vk_path = ZKML_DIR / "deed_cnn.vk"
    pk_path = ZKML_DIR / "deed_cnn.pk"
    proofs_dir = ZKML_DIR / "proofs"
    witnesses_dir = ZKML_DIR / "witnesses"
    bench_path = ZKML_DIR / "bench_output.json"

    proofs_dir.mkdir(parents=True, exist_ok=True)
    witnesses_dir.mkdir(parents=True, exist_ok=True)

    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    model = DeedFraudCNN(input_dim=int(checkpoint["input_dim"]))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    df = load_dataset(dataset_path)
    features = build_feature_matrix(df, means=np.array(checkpoint["means"]), stds=np.array(checkpoint["stds"])).features
    with torch.no_grad():
        logits = model(torch.from_numpy(features)).squeeze(1).numpy()
    probs = 1.0 / (1.0 + np.exp(-logits))

    candidate_indices = np.where(probs < 0.5)[0]
    if candidate_indices.shape[0] < 10:
        raise SystemExit("not enough samples with fraud_score < 0.5 to prove")
    selected = candidate_indices[:10]

    calibration_samples = features[: min(256, features.shape[0])]
    _write_input_json(calibration_path, calibration_samples)

    run_args = ezkl.PyRunArgs()
    run_args.input_visibility = "private"
    run_args.param_visibility = "private"
    run_args.output_visibility = "public"
    run_args.logrows = 14
    run_args.input_scale = 7
    run_args.param_scale = 7
    run_args.scale_rebase_multiplier = 1

    ok = await _resolve(ezkl.gen_settings(onnx_path.as_posix(), settings_path.as_posix(), run_args))
    if not ok:
        raise SystemExit("ezkl.gen_settings failed")

    ok = await _resolve(
        ezkl.calibrate_settings(
            data=calibration_path.as_posix(),
            model=onnx_path.as_posix(),
            settings=settings_path.as_posix(),
            target="resources",
            lookup_safety_margin=2.0,
            scales=None,
            scale_rebase_multiplier=[1],
            max_logrows=14,
        )
    )
    if not ok:
        raise SystemExit("ezkl.calibrate_settings failed")

    ok = await _resolve(ezkl.compile_circuit(onnx_path.as_posix(), compiled_path.as_posix(), settings_path.as_posix()))
    if not ok:
        raise SystemExit("ezkl.compile_circuit failed")

    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    logrows = _extract_logrows(settings)
    await _resolve(ezkl.gen_srs(srs_path.as_posix(), logrows))

    ok = await _resolve(
        ezkl.setup(
            model=compiled_path.as_posix(),
            vk_path=vk_path.as_posix(),
            pk_path=pk_path.as_posix(),
            srs_path=srs_path.as_posix(),
            witness_path=None,
            disable_selector_compression=False,
        )
    )
    if not ok:
        raise SystemExit("ezkl.setup failed")

    proof_times_ms: list[float] = []
    for prove_idx, row_idx in enumerate(selected):
        sample = features[row_idx : row_idx + 1]
        if float(probs[row_idx]) >= 0.5:
            raise SystemExit(f"sample idx {int(row_idx)} does not satisfy fraud_score < 0.5")

        data_path = ZKML_DIR / f"sample_{prove_idx:02d}.json"
        witness_path = witnesses_dir / f"sample_{prove_idx:02d}.json"
        proof_path = proofs_dir / f"sample_{prove_idx:02d}.proof"

        _write_input_json(data_path, sample)

        await _resolve(
            ezkl.gen_witness(
                data=data_path.as_posix(),
                model=compiled_path.as_posix(),
                output=witness_path.as_posix(),
                vk_path=None,
                srs_path=None,
            )
        )

        start = time.perf_counter()
        ok = await _resolve(
            ezkl.prove(
                witness=witness_path.as_posix(),
                model=compiled_path.as_posix(),
                pk_path=pk_path.as_posix(),
                proof_path=proof_path.as_posix(),
                srs_path=srs_path.as_posix(),
            )
        )
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        if not ok:
            raise SystemExit(f"ezkl.prove failed for sample {prove_idx}")

        ok = await _resolve(
            ezkl.verify(
                proof_path=proof_path.as_posix(),
                settings_path=settings_path.as_posix(),
                vk_path=vk_path.as_posix(),
                srs_path=srs_path.as_posix(),
                reduced_srs=False,
            )
        )
        if not ok:
            raise SystemExit(f"ezkl.verify failed for sample {prove_idx}")
        proof_times_ms.append(elapsed_ms)

    avg_proof_ms = float(np.mean(proof_times_ms))
    if avg_proof_ms >= 10_000.0:
        raise SystemExit(f"proof_gen_ms too high: {avg_proof_ms:.2f} >= 10000")

    auc = float(json.loads(metrics_path.read_text(encoding="utf-8"))["final_auc"])
    model_size_mb = onnx_path.stat().st_size / (1024 * 1024)
    bench = {
        "ezkl_version": ezkl.__version__,
        "proof_gen_ms": round(avg_proof_ms, 2),
        "model_size_mb": round(model_size_mb, 4),
        "samples_proven": 10,
        "auc": round(auc, 4),
    }
    bench_path.write_text(json.dumps(bench, indent=2), encoding="utf-8")

    print(f"ezkl_version={bench['ezkl_version']}")
    print(f"proof_gen_ms={bench['proof_gen_ms']}")
    print(f"model_size_mb={bench['model_size_mb']}")
    print("samples_proven=10")
    print(f"auc={bench['auc']}")
    print(f"bench_output={bench_path}")


if __name__ == "__main__":
    asyncio.run(main())
