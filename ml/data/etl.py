#!/usr/bin/env python3
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

N_VALID = 2000
N_FRAUD = 2000
SEED = 42


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _generate_valid(rng: np.random.Generator, idx: int) -> dict[str, object]:
    synthetic_id = f"valid-{idx}-{rng.integers(0, 10**12)}"
    return {
        "deed_hash": _sha256_hex(synthetic_id),
        "text_length": int(np.clip(rng.normal(1450, 220), 600, 2400)),
        "num_signatures": int(rng.choice([2, 3, 4], p=[0.30, 0.50, 0.20])),
        "notary_present": bool(rng.random() < 0.50),
        "days_since_notarized": int(rng.integers(1, 366)),
        "amount": float(np.clip(rng.lognormal(np.log(260_000), 0.40), 20_000, 2_000_000)),
        "label": 0,
    }


def _generate_fraud(rng: np.random.Generator, idx: int) -> dict[str, object]:
    synthetic_id = f"fraud-{idx}-{rng.integers(0, 10**12)}"
    scenario = int(rng.integers(0, 4))

    if scenario == 0:
        text_length = int(np.clip(rng.normal(520, 180), 120, 1100))
        num_signatures = int(rng.choice([0, 1, 2], p=[0.45, 0.40, 0.15]))
        days_since_notarized = int(rng.integers(1, 366))
        amount = float(np.clip(rng.lognormal(np.log(300_000), 0.55), 15_000, 2_500_000))
    elif scenario == 1:
        text_length = int(np.clip(rng.normal(1500, 260), 600, 2600))
        num_signatures = int(rng.choice([2, 3, 4], p=[0.30, 0.45, 0.25]))
        days_since_notarized = int(rng.integers(1, 366))
        amount = float(rng.choice([rng.uniform(500, 8_000), rng.uniform(4_000_000, 9_000_000)]))
    elif scenario == 2:
        text_length = int(np.clip(rng.normal(1480, 220), 700, 2500))
        num_signatures = int(rng.integers(5, 10))
        days_since_notarized = int(rng.integers(1, 366))
        amount = float(np.clip(rng.lognormal(np.log(240_000), 0.45), 15_000, 3_000_000))
    else:
        text_length = int(np.clip(rng.normal(900, 240), 300, 1800))
        num_signatures = int(rng.choice([1, 2, 5], p=[0.45, 0.15, 0.40]))
        days_since_notarized = int(rng.integers(1, 366))
        amount = float(np.clip(rng.lognormal(np.log(250_000), 0.80), 1_000, 7_500_000))

    return {
        "deed_hash": _sha256_hex(synthetic_id),
        "text_length": text_length,
        "num_signatures": num_signatures,
        "notary_present": bool(rng.random() < 0.50),
        "days_since_notarized": days_since_notarized,
        "amount": amount,
        "label": 1,
    }


def main() -> None:
    rng = np.random.default_rng(SEED)
    records: list[dict[str, object]] = []
    records.extend(_generate_valid(rng, idx) for idx in range(N_VALID))
    records.extend(_generate_fraud(rng, idx) for idx in range(N_FRAUD))

    df = pd.DataFrame.from_records(records)
    df = df.sample(frac=1.0, random_state=SEED).reset_index(drop=True)

    output_path = Path(__file__).resolve().parent / "deeds_dataset.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    print(f"wrote={output_path}")
    print(f"rows={len(df)} valid={(df['label'] == 0).sum()} fraud={(df['label'] == 1).sum()}")
    print(f"columns={','.join(df.columns)}")


if __name__ == "__main__":
    main()
