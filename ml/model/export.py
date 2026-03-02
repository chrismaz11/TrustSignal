#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import onnx
import torch

from common import DeedFraudCNN


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    checkpoint_path = root / "ml" / "model" / "deed_cnn.pt"
    onnx_path = root / "ml" / "model" / "deed_cnn.onnx"

    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    input_dim = int(checkpoint["input_dim"])

    model = DeedFraudCNN(input_dim=input_dim)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    dummy_input = torch.randn(1, input_dim, dtype=torch.float32)
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        dynamo=False,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["features"],
        output_names=["fraud_logit"],
        dynamic_axes={"features": {0: "batch_size"}, "fraud_logit": {0: "batch_size"}},
    )

    onnx_model = onnx.load(onnx_path.as_posix())
    onnx.checker.check_model(onnx_model)

    model_size_mb = onnx_path.stat().st_size / (1024 * 1024)
    if model_size_mb >= 5:
        raise SystemExit(f"ONNX file too large: {model_size_mb:.4f} MB >= 5 MB")

    print(f"onnx_ok={onnx_path}")
    print(f"model_size_mb={model_size_mb:.4f}")


if __name__ == "__main__":
    main()
