#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

HASH_BYTES = 8


class DeedFraudCNN(nn.Module):
    def __init__(self, input_dim: int) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv1d(1, 8, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(8, 12, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AvgPool1d(kernel_size=input_dim),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(12, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )
        self.input_dim = input_dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x.unsqueeze(1)
        x = self.features(x)
        return self.classifier(x)


@dataclass
class FeaturePack:
    features: np.ndarray
    labels: np.ndarray
    means: np.ndarray
    stds: np.ndarray


def _hash_to_vec(hash_hex: str) -> np.ndarray:
    raw = bytes.fromhex(hash_hex)[:HASH_BYTES]
    vec = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 255.0
    if vec.shape[0] != HASH_BYTES:
        raise ValueError("invalid hash length for feature extraction")
    return vec


def build_feature_matrix(
    df: pd.DataFrame, means: np.ndarray | None = None, stds: np.ndarray | None = None
) -> FeaturePack:
    hash_mat = np.stack(df["deed_hash"].astype(str).map(_hash_to_vec).to_list(), axis=0)

    scalar_mat = np.stack(
        [
            df["text_length"].astype(np.float32).to_numpy(),
            df["num_signatures"].astype(np.float32).to_numpy(),
            np.log1p(df["amount"].astype(np.float32).to_numpy()),
        ],
        axis=1,
    )

    features = np.concatenate([hash_mat, scalar_mat], axis=1).astype(np.float32)
    labels = df["label"].astype(np.float32).to_numpy(copy=True)

    if means is None or stds is None:
        means = features.mean(axis=0)
        stds = features.std(axis=0)
        stds = np.where(stds < 1e-6, 1.0, stds)

    normalized = (features - means) / stds
    return FeaturePack(features=normalized.astype(np.float32), labels=labels, means=means, stds=stds)


def load_dataset(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["notary_present"] = df["notary_present"].astype(str).str.lower().isin({"1", "true", "t", "yes"})
    required = {
        "deed_hash",
        "text_length",
        "num_signatures",
        "notary_present",
        "days_since_notarized",
        "amount",
        "label",
    }
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"dataset missing columns: {sorted(missing)}")
    return df


def save_checkpoint(
    output_path: Path,
    model: DeedFraudCNN,
    means: np.ndarray,
    stds: np.ndarray,
    final_auc: float,
) -> None:
    payload: dict[str, Any] = {
        "state_dict": model.state_dict(),
        "input_dim": int(model.input_dim),
        "hash_bytes": HASH_BYTES,
        "means": means.tolist(),
        "stds": stds.tolist(),
        "final_auc": float(final_auc),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(payload, output_path)
