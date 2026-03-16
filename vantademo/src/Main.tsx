import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const lines = [
  "christopher@Christophers-Mac-mini trustsignal % npm run demo:vanta-terminal",
  "",
  "============================================================",
  "TrustSignal Terminal Demo",
  "============================================================",
  "TrustSignal is being shown here as backend evidence-integrity infrastructure.",
  "The operator sends an artifact once, TrustSignal issues a signed receipt, and later verification proves the receipt has not been altered.",
  "This demo does not claim production-grade blockchain or ZK enforcement. It shows the receipt and evidence chain that exist in code today.",
  "For deterministic output, AI-based document compliance checks are intentionally not part of this walkthrough.",
  "============================================================",
  "Flow 1: Valid Artifact Intake",
  "============================================================",
  "Step 1: Submit a baseline artifact with a stable declared digest and issue a signed integrity receipt.",
  "Receipt ID:        fd34996b-54e9-4111-94e3-ae637f6ce84f",
  "Receipt Hash:      0xeb6d9cdb5f961166dc6e5060691131ef02fb05834e8565baf5dbd8eff2fcac00",
  "Signature Alg:     EdDSA",
  "Signature Kid:     dev-local-receipt-signer-v1",
  "Signature Status:  verified",
  "Integrity Result:  verified",
  "Receipt Verify:    verified",
  "Artifact Match:    declared digest recorded for issuance",
  "Receipt Fetch:     persisted and retrievable",
  "Policy Decision:   ALLOW",
  "============================================================",
  "Flow 2: Tampered Artifact Intake",
  "============================================================",
  "Step 2: Reuse the original declared hash and notary seal, but change the artifact bytes before submission.",
  "Receipt ID:        f8decc3f-ac6c-48a0-804f-2f905752f2d0",
  "Receipt Hash:      0x97717e5f0d90064804cb11304eb30e3554f7b642036d21b6bc4a10e0f9d70e41",
  "Signature Status:  verified",
  "Integrity Result:  verified",
  "Receipt Verify:    verified",
  "Declared Hash:     0xe486824f4ccb4cef...",
  "Observed Digest:   0x05c7755edc619a6c...",
  "Artifact Match:    mismatch detected",
  "Witness Mode:      canonical-document-bytes-v1",
  "Proof Status:      dev-only",
  "============================================================",
  "Operator Summary",
  "============================================================",
  "Valid Flow Final Result:     receipt verified",
  "Tampered Flow Final Result:  tamper-evident mismatch recorded",
  "Receipt Signature Metadata:  EdDSA / dev-local-receipt-signer-v1",
  "Implementation Truth: receipt signing and receipt verification are real; dev-only ZKP remains dev-only in this demo.",
  "",
  "christopher@Christophers-Mac-mini trustsignal %",
];

const Overlay: React.FC<{text: string}> = ({text}) => (
  <div
    style={{
      position: "absolute",
      top: 30,
      right: 40,
      padding: "10px 16px",
      borderRadius: 8,
      background: "rgba(0,0,0,0.55)",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "#fff",
      fontSize: 18,
      fontWeight: 500,
      backdropFilter: "blur(6px)",
    }}
  >
    {text}
  </div>
);

const getLineColor = (line: string) => {
  if (line.includes("mismatch detected")) return "#ff6b6b";
  if (line.includes("verified")) return "#7ee787";
  if (line.includes("ALLOW")) return "#ffd866";
  if (line.startsWith("Flow 1")) return "#61afef";
  if (line.startsWith("Flow 2")) return "#e5c07b";
  if (line.startsWith("Operator Summary")) return "#c678dd";
  if (line.startsWith("============================================================")) return "#5c6370";
  if (line.startsWith("christopher@")) return "#98c379";
  return "#e6edf3";
};

const getLineWeight = (line: string) => {
  if (
    line.startsWith("christopher@") ||
    line.includes("mismatch detected") ||
    line.includes("Signature Status") ||
    line.includes("Receipt Verify") ||
    line.includes("Integrity Result")
  ) {
    return 600;
  }
  return 400;
};

const getLineCost = (line: string) => {
  let cost = 1;

  if (line === "") cost += 4;
  if (line.startsWith("============================================================")) cost += 6;
  if (line.startsWith("Flow 1") || line.startsWith("Flow 2") || line.startsWith("Operator Summary")) cost += 8;
  if (line.includes("mismatch detected")) cost += 10;
  if (line.includes("Policy Decision:   ALLOW")) cost += 4;

  return cost;
};

const getVisibleLinesByBudget = (allLines: string[], budget: number) => {
  let remaining = budget;
  const visible: string[] = [];

  for (const line of allLines) {
    const cost = getLineCost(line);
    if (remaining >= cost) {
      visible.push(line);
      remaining -= cost;
    } else {
      break;
    }
  }

  return visible;
};

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const linesPerSecond = 7;
  const budget = Math.floor((frame / fps) * linesPerSecond);

  const visibleLines = getVisibleLinesByBudget(lines, budget);

  const lineHeight = 28;
  const terminalHeight = height * 0.88 - 52;
  const maxRows = Math.floor((terminalHeight - 40) / lineHeight);
  const start = Math.max(0, visibleLines.length - maxRows);

  const mismatchVisible = visibleLines.some((l) =>
    l.includes("mismatch detected")
  );

  const pulse = mismatchVisible
    ? interpolate(Math.sin(frame / 4), [-1, 1], [0.8, 1])
    : 1;

  const pop = spring({
    frame,
    fps,
    config: {damping: 200, stiffness: 120},
  });

  const receiptIssued = visibleLines.some((l) =>
    l.includes("Signature Status")
  );

  const receiptVerified = visibleLines.some((l) =>
    l.includes("Receipt Verify")
  );

  const tamperDetected = visibleLines.some((l) =>
    l.includes("mismatch detected")
  );

  const allCost = lines.reduce((sum, line) => sum + getLineCost(line), 0);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top,#161b22 0%,#0d1117 55%,#090c10 100%)",
        fontFamily:
          'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      }}
    >
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${0.92 + 0.08 * pop})`,
          opacity: pop,
        }}
      >
        <div
          style={{
            width: width * 0.9,
            height: height * 0.88,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#0d1117",
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              padding: "0 18px",
              background: "#161b22",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              gap: 10,
            }}
          >
            <div style={{width: 12, height: 12, borderRadius: 999, background: "#ff5f57"}} />
            <div style={{width: 12, height: 12, borderRadius: 999, background: "#febc2e"}} />
            <div style={{width: 12, height: 12, borderRadius: 999, background: "#28c840"}} />
            <div style={{marginLeft: 16, color: "#c9d1d9", fontSize: 18}}>
              Terminal — TrustSignal Demo
            </div>
          </div>

          <div
            style={{
              position: "relative",
              height: terminalHeight,
              padding: "20px 24px",
              overflow: "hidden",
            }}
          >
            {visibleLines.slice(start, start + maxRows).map((line, i) => {
              const mismatch = line.includes("mismatch detected");

              return (
                <div
                  key={`${start + i}-${line}`}
                  style={{
                    whiteSpace: "pre",
                    fontSize: 20,
                    lineHeight: `${lineHeight}px`,
                    color: getLineColor(line),
                    opacity: mismatch ? pulse : 1,
                    fontWeight: getLineWeight(line),
                    textShadow: mismatch
                      ? "0 0 12px rgba(255,107,107,0.35)"
                      : "none",
                  }}
                >
                  {line}
                </div>
              );
            })}

            {budget < allCost && (
              <div
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 24,
                  background: "#e6edf3",
                  opacity: frame % 24 < 12 ? 1 : 0,
                }}
              />
            )}
          </div>
        </div>

        {receiptIssued && !receiptVerified && (
          <Overlay text="Signed receipt issued" />
        )}

        {receiptVerified && !tamperDetected && (
          <Overlay text="Receipt integrity verified" />
        )}

        {tamperDetected && <Overlay text="Tamper detected" />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
