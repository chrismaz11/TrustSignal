#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from fairlearn.metrics import MetricFrame, false_positive_rate, selection_rate, true_positive_rate
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, TensorDataset

from common import DeedFraudCNN, build_feature_matrix, load_dataset, save_checkpoint

SEED = 42
EPOCHS = 40
BATCH_SIZE = 64
LR = 1e-3


def _max_group_gap(values: pd.Series) -> float:
    clean = values.dropna().astype(float)
    if clean.empty:
        return 0.0
    return float(clean.max() - clean.min())


def _write_bias_report(
    path: Path, holdout_df: pd.DataFrame, y_true: np.ndarray, y_pred_label: np.ndarray
) -> None:
    days_bucket = pd.cut(
        holdout_df["days_since_notarized"],
        bins=[0, 90, 180, 270, 365],
        labels=["1-90", "91-180", "181-270", "271-365"],
        include_lowest=True,
    )

    metrics = {
        "selection_rate": selection_rate,
        "false_positive_rate": false_positive_rate,
        "true_positive_rate": true_positive_rate,
    }

    notary_frame = MetricFrame(
        metrics=metrics,
        y_true=y_true,
        y_pred=y_pred_label,
        sensitive_features=holdout_df["notary_present"].map({True: "present", False: "absent"}),
    )
    days_frame = MetricFrame(metrics=metrics, y_true=y_true, y_pred=y_pred_label, sensitive_features=days_bucket)

    notary_gaps = {name: _max_group_gap(notary_frame.by_group[name]) for name in metrics}
    days_gaps = {name: _max_group_gap(days_frame.by_group[name]) for name in metrics}
    no_skew = max(max(notary_gaps.values()), max(days_gaps.values())) <= 0.10

    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Bias Report (Synthetic Deed Fraud Model)",
        "",
        "Assessment scope: holdout split only, synthetic records only, no demographic attributes.",
        "",
        f"Conclusion: {'PASS' if no_skew else 'REVIEW'} (max metric gap <= 0.10 threshold).",
        "",
        "## Notary Present Groups",
        "",
        "```",
        notary_frame.by_group.round(4).to_string(),
        "```",
        "",
        "Metric gaps:",
    ]
    lines.extend([f"- {name}: {gap:.4f}" for name, gap in notary_gaps.items()])
    lines.extend(
        [
            "",
            "## Days Since Notarized Buckets",
            "",
            "```",
            days_frame.by_group.round(4).to_string(),
            "```",
            "",
            "Metric gaps:",
        ]
    )
    lines.extend([f"- {name}: {gap:.4f}" for name, gap in days_gaps.items()])

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    root = Path(__file__).resolve().parents[2]
    dataset_path = root / "ml" / "data" / "deeds_dataset.csv"
    model_path = root / "ml" / "model" / "deed_cnn.pt"
    metrics_path = root / "ml" / "model" / "train_metrics.json"
    bias_report_path = root / "ml" / "reports" / "bias_report.md"

    df = load_dataset(dataset_path)
    train_df, holdout_df = train_test_split(df, test_size=0.20, random_state=SEED, stratify=df["label"])

    train_pack = build_feature_matrix(train_df)
    holdout_pack = build_feature_matrix(holdout_df, means=train_pack.means, stds=train_pack.stds)

    x_train = torch.from_numpy(train_pack.features)
    y_train = torch.from_numpy(train_pack.labels).unsqueeze(1)
    x_holdout = torch.from_numpy(holdout_pack.features)
    y_holdout = holdout_pack.labels

    loader = DataLoader(TensorDataset(x_train, y_train), batch_size=BATCH_SIZE, shuffle=True)
    model = DeedFraudCNN(input_dim=train_pack.features.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = torch.nn.BCEWithLogitsLoss()

    epoch_losses: list[float] = []
    for _ in range(EPOCHS):
        model.train()
        running = 0.0
        count = 0
        for xb, yb in loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            running += float(loss.item()) * xb.size(0)
            count += xb.size(0)
        epoch_losses.append(running / max(count, 1))

    model.eval()
    with torch.no_grad():
        holdout_logits = model(x_holdout).squeeze(1).numpy()
    holdout_probs = 1.0 / (1.0 + np.exp(-holdout_logits))
    final_auc = float(roc_auc_score(y_holdout, holdout_probs))

    if final_auc < 0.85:
        raise SystemExit(f"AUC below target: {final_auc:.4f} < 0.85")

    save_checkpoint(model_path, model, train_pack.means, train_pack.stds, final_auc)
    metrics_path.write_text(json.dumps({"final_auc": final_auc, "epochs": EPOCHS}, indent=2), encoding="utf-8")

    pred_labels = (holdout_probs >= 0.5).astype(np.int32)
    _write_bias_report(bias_report_path, holdout_df.reset_index(drop=True), y_holdout.astype(np.int32), pred_labels)

    print(f"final_auc={final_auc:.4f}")
    print("loss_curve=" + ",".join(f"{v:.6f}" for v in epoch_losses))
    print(f"saved_model={model_path}")
    print(f"saved_bias_report={bias_report_path}")


if __name__ == "__main__":
    main()
