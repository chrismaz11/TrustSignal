
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function clamp01(x: number): number {
    if (Number.isNaN(x)) return 0;
    return Math.min(1, Math.max(0, x));
}

function band(score: number): RiskBand {
    if (score >= 0.66) return "HIGH";
    if (score >= 0.33) return "MEDIUM";
    return "LOW";
}

export function toV2VerifyResponse(input: {
    decision: string;
    reasons?: string[];
    receiptId: string;
    receiptHash: string;
    anchor?: { status?: string; txHash?: string; chainId?: string; anchorId?: string; anchoredAt?: string };
    fraudRisk?: { score?: number; band?: RiskBand; signals?: any[] };
    zkpAttestation?: any;
    revoked?: boolean;
    riskScore?: number;
    includeDeprecated?: boolean;
}) {
    const score = clamp01(input.fraudRisk?.score ?? 0);
    const riskBand = input.fraudRisk?.band ?? band(score);

    const body: any = {
        receiptVersion: "2.0",
        decision: input.decision,
        reasons: input.reasons ?? [],
        receiptId: input.receiptId,
        receiptHash: input.receiptHash,
        anchor: {
            status: input.anchor?.status ?? "PENDING",
            backend: "EVM_LOCAL", // Default for v2 MVP
            ...(input.anchor?.anchorId ? { anchorId: input.anchor.anchorId } : {}),
            ...(input.anchor?.txHash ? { txHash: input.anchor.txHash } : {}),
            ...(input.anchor?.chainId ? { chainId: input.anchor.chainId } : {}),
            ...(input.anchor?.anchoredAt ? { anchoredAt: input.anchor.anchoredAt } : {})
        },
        fraudRisk: {
            score,
            band: riskBand,
            signals: input.fraudRisk?.signals ?? []
        },
        zkpAttestation: input.zkpAttestation,
        revocation: {
            status: input.revoked ? "REVOKED" : "ACTIVE"
        }
    };

    if (input.includeDeprecated) {
        body.deprecated = {
            riskScore: typeof input.riskScore === "number"
                ? input.riskScore
                : Math.round(score * 100),
            revoked: Boolean(input.revoked)
        };
    }

    return body;
}
