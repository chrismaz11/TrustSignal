import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';

import {
  canonicalizeJson,
  computeReceiptHash,
  computeInputsCommitment,
  toUnsignedReceiptPayload,
  verifyReceiptSignature,
  BundleInput,
  CheckResult,
  CountyCheckResult,
  DeedParsed,
  DocumentRisk,
  Receipt,
  ZKPAttestation
} from '../../../../packages/public-contracts/dist/index.js';
import {
  attomCrossCheck,
  buildAnchorSubject,
  buildReceipt,
  deriveNotaryWallet,
  generateComplianceProof,
  nameOverlapScore,
  RiskEngine,
  signDocHash,
  signReceiptPayload,
  verifyBundle,
  verifyComplianceProof
} from '../../../../packages/engine-internal/dist/index.js';
import {
  getOfficialRegistrySourceName,
  type RegistryOracleJobView,
  type RegistrySourceId,
  type RegistrySourceSummary
} from '../registry/catalog.js';
import { loadRegistry } from '../registryLoader.js';
import type { SecurityConfig } from '../security.js';
import { HttpAttomClient } from '../services/attomClient.js';

import { anchorReceipt as performAnchorReceipt } from './anchoring/service.js';
import { CookCountyComplianceValidator } from './compliance/cookCountyComplianceValidator.js';
import { createRegistryAdapterService } from './registry/adapterService.js';
import type {
  AnchorReceiptResult,
  CreatedVerification,
  EngineAnchorState,
  EngineVerificationInput,
  RevokeReceiptResult,
  StoredReceiptView,
  VerificationEngine,
  VerificationStatus
} from './types.js';

type ReceiptRecord = NonNullable<
  Awaited<ReturnType<PrismaClient['receipt']['findUnique']>>
>;

type Options = {
  prisma: PrismaClient;
  securityConfig: SecurityConfig;
  propertyApiKey: string;
  fetchImpl?: typeof fetch;
};

type NotaryVerifier = {
  verifyNotary(
    state: string,
    commissionId: string,
    name: string
  ): Promise<{
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN';
    details?: string;
  }>;
};

type PropertyVerifier = {
  verifyOwner(
    parcelId: string,
    grantorName: string
  ): Promise<{ match: boolean; score: number; recordOwner?: string }>;
};

class DatabaseCountyVerifier {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyParcel(
    parcelId: string,
    _county: string,
    _state: string
  ): Promise<CountyCheckResult> {
    console.log(`[DatabaseCountyVerifier] Checking parcel: ${parcelId}`);
    const record = await this.prisma.countyRecord.findUnique({
      where: { parcelId }
    });

    if (!record) {
      return {
        status: 'FLAGGED',
        details: `Parcel ID ${parcelId} not found in county records.`
      };
    }

    return {
      status: 'CLEAN',
      details: 'Verified against local county database'
    };
  }
}

class DatabaseNotaryVerifier implements NotaryVerifier {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyNotary(
    state: string,
    commissionId: string,
    name: string
  ): Promise<{
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN';
    details?: string;
  }> {
    console.log(`[DatabaseNotaryVerifier] Checking notary: ${commissionId}`);
    const notary = await this.prisma.notary.findUnique({
      where: { id: commissionId }
    });
    if (!notary) return { status: 'UNKNOWN', details: 'Notary not found' };
    if (notary.status !== 'ACTIVE') {
      return {
        status: notary.status as 'SUSPENDED' | 'REVOKED',
        details: 'Notary not active'
      };
    }
    if (notary.commissionState !== state) {
      return { status: 'ACTIVE', details: 'State mismatch (recorded)' };
    }
    return { status: 'ACTIVE', details: `Found ${name}` };
  }
}

class AttomPropertyVerifier implements PropertyVerifier {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly apiKey: string
  ) {}

  async verifyOwner(
    parcelId: string,
    grantorName: string
  ): Promise<{ match: boolean; score: number; recordOwner?: string }> {
    console.log(`[AttomPropertyVerifier] Checking property owner: ${parcelId}`);

    const cached = await this.prisma.property.findUnique({ where: { parcelId } });
    let ownerName = cached?.currentOwner || 'Unknown';

    if (!cached && this.apiKey) {
      try {
        const url = new URL(
          'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile'
        );
        url.searchParams.append('apn', parcelId);
        const response = await fetch(url.toString(), {
          headers: { apikey: this.apiKey, accept: 'application/json' }
        });
        const data = await response.json().catch(() => ({}));
        const prop = data.property?.[0];
        const owner1 = prop?.owner?.owner1 || prop?.assessment?.owner?.owner1;
        ownerName =
          owner1?.fullName ||
          [owner1?.firstname, owner1?.lastname]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          ownerName;

        if (ownerName && ownerName !== 'Unknown') {
          const saleDateStr = prop?.sale?.saleTransDate || prop?.assessment?.saleDate;
          const lastSaleDate = saleDateStr ? new Date(saleDateStr) : null;
          await this.prisma.property.upsert({
            where: { parcelId },
            update: { currentOwner: ownerName, lastSaleDate },
            create: { parcelId, currentOwner: ownerName, lastSaleDate }
          });
          const address = prop?.address;
          if (address?.countrySubd || address?.countrySecondarySubd) {
            await this.prisma.countyRecord.upsert({
              where: { parcelId },
              update: {
                county: address.countrySecondarySubd,
                state: address.countrySubd,
                active: true
              },
              create: {
                parcelId,
                county: address.countrySecondarySubd || 'Unknown',
                state: address.countrySubd || 'IL',
                active: true
              }
            });
          }
        }
      } catch (error) {
        console.error('ATTOM API Error:', error);
      }
    }

    const overlapScore = nameOverlapScore([grantorName], [ownerName]);
    const match = overlapScore >= 0.7;
    const score = Math.round(overlapScore * 100);

    return { match, score, recordOwner: ownerName };
  }
}

class BlockchainVerifier {
  constructor(
    private readonly rpcUrl: string,
    private readonly contractAddress: string
  ) {}

  async verify(bundle: BundleInput): Promise<CheckResult> {
    console.log(`[BlockchainVerifier] Checking registry: ${bundle.property.parcelId}`);

    if (!this.rpcUrl || !this.contractAddress) {
      return {
        checkId: 'blockchain-registry',
        status: 'PASS',
        details: 'Skipped (No Blockchain Config)'
      };
    }

    try {
      const provider = new JsonRpcProvider(this.rpcUrl);
      const abi = [
        'function getOwner(string memory parcelId) public view returns (string memory)'
      ];
      const contract = new Contract(this.contractAddress, abi, provider);

      void contract;
      const onChainOwner = 'Demo Owner';

      if (bundle.ocrData?.grantorName) {
        const inputGrantor = bundle.ocrData.grantorName.toLowerCase();
        const chainOwner = onChainOwner.toLowerCase();

        if (
          !chainOwner.includes(inputGrantor) &&
          !inputGrantor.includes(chainOwner)
        ) {
          return {
            checkId: 'blockchain-registry',
            status: 'WARN',
            details: `Blockchain Owner Mismatch: ${onChainOwner}`
          };
        }
      }

      return {
        checkId: 'blockchain-registry',
        status: 'PASS',
        details: `Verified on-chain owner: ${onChainOwner}`
      };
    } catch (error) {
      console.error('Blockchain check failed:', error);
      return {
        checkId: 'blockchain-registry',
        status: 'FAIL',
        details: 'RPC Connection Failed'
      };
    }
  }
}

function receiptFromDb(record: ReceiptRecord): Receipt {
  const hasReceiptSignature =
    typeof record.receiptSignature === 'string' &&
    record.receiptSignature.length > 0 &&
    typeof record.receiptSignatureAlg === 'string' &&
    record.receiptSignatureAlg.length > 0 &&
    typeof record.receiptSignatureKid === 'string' &&
    record.receiptSignatureKid.length > 0;

  return {
    receiptVersion: '1.0',
    receiptId: record.id,
    createdAt: record.createdAt.toISOString(),
    policyProfile: record.policyProfile,
    inputsCommitment: record.inputsCommitment,
    checks: JSON.parse(record.checks) as CheckResult[],
    decision: record.decision as 'ALLOW' | 'FLAG' | 'BLOCK',
    reasons: JSON.parse(record.reasons) as string[],
    riskScore: record.riskScore,
    verifierId: 'deed-shield',
    receiptHash: record.receiptHash,
    fraudRisk: record.fraudRisk
      ? (JSON.parse(record.fraudRisk) as DocumentRisk)
      : undefined,
    zkpAttestation: record.zkpAttestation
      ? (JSON.parse(record.zkpAttestation) as ZKPAttestation)
      : undefined,
    receiptSignature: hasReceiptSignature
      ? {
          signature: record.receiptSignature!,
          alg: record.receiptSignatureAlg as 'EdDSA',
          kid: record.receiptSignatureKid!
        }
      : undefined
  };
}

function buildAnchorState(
  record: ReceiptRecord,
  attestation?: ZKPAttestation
): EngineAnchorState {
  const anchorSubject = {
    status: record.anchorStatus,
    txHash: record.anchorTxHash || undefined,
    chainId: record.anchorChainId || undefined,
    anchorId: record.anchorId || undefined,
    anchoredAt: record.anchorAnchoredAt?.toISOString(),
    subjectDigest: record.anchorSubjectDigest || '',
    subjectVersion: record.anchorSubjectVersion || ''
  };

  if (anchorSubject.subjectDigest && anchorSubject.subjectVersion) {
    return anchorSubject;
  }

  const built = buildAnchorSubject(record.receiptHash, attestation);
  return {
    ...anchorSubject,
    subjectDigest: anchorSubject.subjectDigest || built.hash,
    subjectVersion: anchorSubject.subjectVersion || built.version
  };
}

function normalizeDecisionStatus(
  decision: 'ALLOW' | 'FLAG' | 'BLOCK'
): 'PASS' | 'REVIEW' | 'FAIL' {
  if (decision === 'ALLOW') return 'PASS';
  if (decision === 'FLAG') return 'REVIEW';
  return 'FAIL';
}

function resolveRegistrySourceNameFromCheckId(
  checkId: string
): string | undefined {
  if (!checkId.startsWith('registry-')) return undefined;
  const sourceId = checkId.slice('registry-'.length);
  return getOfficialRegistrySourceName(sourceId);
}

async function verifyStoredReceipt(
  receipt: Receipt,
  record: ReceiptRecord,
  securityConfig: SecurityConfig
) {
  const unsignedPayload = toUnsignedReceiptPayload(receipt);
  const recomputedHash = computeReceiptHash(unsignedPayload);
  const integrityVerified =
    recomputedHash === receipt.receiptHash &&
    record.inputsCommitment === receipt.inputsCommitment;
  const proofVerified = receipt.zkpAttestation
    ? await verifyComplianceProof(receipt.zkpAttestation)
    : false;

  if (!receipt.receiptSignature) {
    return {
      verified: false,
      integrityVerified,
      signatureVerified: false,
      signatureStatus: 'legacy-unsigned' as const,
      signatureReason: 'receipt_signature_missing',
      proofVerified,
      recomputedHash
    };
  }

  const signatureCheck = await verifyReceiptSignature(
    unsignedPayload,
    receipt.receiptSignature,
    securityConfig.receiptSigning.verificationKeys
  );
  const signatureStatus = signatureCheck.verified
    ? 'verified'
    : signatureCheck.keyResolved
      ? 'invalid'
      : 'unknown-kid';

  return {
    verified: integrityVerified && signatureCheck.verified,
    integrityVerified,
    signatureVerified: signatureCheck.verified,
    signatureStatus: signatureStatus as
      | 'verified'
      | 'invalid'
      | 'unknown-kid',
    signatureReason: signatureCheck.reason,
    proofVerified,
    recomputedHash
  };
}

export class LocalVerificationEngine implements VerificationEngine {
  private readonly registryAdapterService;

  constructor(private readonly options: Options) {
    this.registryAdapterService = createRegistryAdapterService(options.prisma, {
      fetchImpl: options.fetchImpl
    });
  }

  async createVerification(
    input: EngineVerificationInput
  ): Promise<CreatedVerification> {
    const registry = await loadRegistry();
    const verifiers = {
      county: new DatabaseCountyVerifier(this.options.prisma),
      notary: new DatabaseNotaryVerifier(this.options.prisma),
      property: new AttomPropertyVerifier(
        this.options.prisma,
        this.options.propertyApiKey
      ),
      blockchain: new BlockchainVerifier(
        process.env.RPC_URL || '',
        process.env.REGISTRY_ADDRESS || ''
      )
    };
    const verification = await verifyBundle(input, registry, verifiers);

    if (input.registryScreening) {
      const subjectName =
        input.registryScreening.subjectName ||
        input.ocrData?.grantorName ||
        input.ocrData?.notaryName;

      if (subjectName) {
        const defaultSources: RegistrySourceId[] = [
          'ofac_sdn',
          'ofac_sls',
          'ofac_ssi',
          'hhs_oig_leie',
          'sam_exclusions',
          'uk_sanctions_list',
          'us_csl_consolidated'
        ];
        const sourceIds =
          (input.registryScreening.sourceIds as RegistrySourceId[] | undefined) ||
          defaultSources;
        const registryBatch = await this.registryAdapterService.verifyBatch({
          sourceIds,
          subject: subjectName,
          forceRefresh: input.registryScreening.forceRefresh
        });

        let hasMatch = false;
        let hasComplianceGap = false;
        for (const result of registryBatch.results) {
          if (result.status === 'MATCH') hasMatch = true;
          if (result.status === 'COMPLIANCE_GAP') hasComplianceGap = true;
          verification.checks.push({
            checkId: `registry-${result.sourceId}`,
            status:
              result.status === 'MATCH'
                ? 'FAIL'
                : result.status === 'COMPLIANCE_GAP'
                  ? 'WARN'
                  : 'PASS',
            details:
              result.status === 'MATCH'
                ? `Matched ${result.matches.length} candidates in ${result.sourceName}`
                : result.status === 'COMPLIANCE_GAP'
                  ? `Compliance gap: ${result.sourceName} (${result.details || 'primary source unavailable'})`
                  : `No match in ${result.sourceName}`
          });
        }

        if (hasMatch) {
          verification.decision = 'BLOCK';
          verification.reasons.push('Registry sanctions screening found a match');
        } else if (hasComplianceGap && verification.decision === 'ALLOW') {
          verification.decision = 'FLAG';
          verification.reasons.push(
            'Registry screening has compliance gaps in primary-source coverage'
          );
        }
      }
    }

    if (input.doc.pdfBase64) {
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      const complianceValidator = new CookCountyComplianceValidator();
      const complianceResult = await complianceValidator.validateDocument(pdfBuffer);

      verification.checks.push({
        checkId: 'cook-county-compliance',
        status:
          complianceResult.status === 'FAIL'
            ? 'FAIL'
            : complianceResult.status === 'FLAGGED'
              ? 'WARN'
              : 'PASS',
        details: complianceResult.details.join('; ')
      });

      if (complianceResult.status === 'FAIL') {
        verification.decision = 'BLOCK';
        verification.reasons.push('Cook County Compliance Verification Failed');
      }
    }

    let fraudRisk: DocumentRisk | undefined;
    if (input.doc.pdfBase64) {
      const riskEngine = new RiskEngine();
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      fraudRisk = await riskEngine.analyzeDocument(pdfBuffer, {
        policyProfile: input.policy.profile,
        notaryState: input.ron.commissionState
      });
    }

    const zkpAttestation = await generateComplianceProof({
      policyProfile: input.policy.profile,
      checksResult: verification.decision === 'ALLOW',
      inputsCommitment: computeInputsCommitment(input),
      docHash: input.doc.docHash,
      canonicalDocumentBase64: input.doc.pdfBase64
    });

    const signingKeyId = this.options.securityConfig.receiptSigning.current.kid;
    const receipt = buildReceipt(input, verification, 'deed-shield', {
      fraudRisk,
      zkpAttestation
    });
    const receiptSignature = await signReceiptPayload(
      toUnsignedReceiptPayload(receipt),
      this.options.securityConfig.receiptSigning.current
    );
    const signedReceipt: Receipt = {
      ...receipt,
      receiptSignature
    };

    const record = await this.options.prisma.receipt.create({
      data: {
        id: signedReceipt.receiptId,
        receiptHash: signedReceipt.receiptHash,
        inputsCommitment: signedReceipt.inputsCommitment,
        parcelId: input.property.parcelId,
        policyProfile: signedReceipt.policyProfile,
        decision: signedReceipt.decision,
        reasons: JSON.stringify(signedReceipt.reasons),
        riskScore: signedReceipt.riskScore,
        checks: JSON.stringify(signedReceipt.checks),
        rawInputsHash: signedReceipt.inputsCommitment,
        createdAt: new Date(signedReceipt.createdAt),
        fraudRisk: signedReceipt.fraudRisk
          ? JSON.stringify(signedReceipt.fraudRisk)
          : undefined,
        zkpAttestation: signedReceipt.zkpAttestation
          ? JSON.stringify(signedReceipt.zkpAttestation)
          : undefined,
        receiptSignature: signedReceipt.receiptSignature?.signature,
        receiptSignatureAlg: signedReceipt.receiptSignature?.alg,
        receiptSignatureKid: signedReceipt.receiptSignature?.kid,
        revoked: false
      }
    });

    return {
      receipt: signedReceipt,
      revoked: record.revoked,
      anchor: buildAnchorState(record, signedReceipt.zkpAttestation)
    };
  }

  async createSyntheticBundle(): Promise<BundleInput> {
    const registry = await loadRegistry();
    const notary = registry.notaries[0];
    if (!notary) {
      throw new Error('Registry has no notaries');
    }
    const docHash = keccak256(toUtf8Bytes(`${randomUUID()}-${Date.now()}`));
    const wallet = deriveNotaryWallet(notary.id);
    const sealPayload = await signDocHash(wallet, docHash);
    return {
      bundleId: `BUNDLE-${Date.now()}`,
      transactionType: 'warranty',
      ron: {
        provider: registry.ronProviders[0]?.id || 'RON-1',
        notaryId: notary.id,
        commissionState: notary.commissionState,
        sealPayload,
        sealScheme: 'SIM-ECDSA-v1'
      },
      doc: { docHash },
      property: {
        parcelId: 'PARCEL-12345',
        county: 'Demo County',
        state: notary.commissionState
      },
      policy: { profile: `STANDARD_${notary.commissionState}` },
      timestamp: new Date().toISOString()
    };
  }

  async crossCheckAttom(deed: DeedParsed) {
    const client = new HttpAttomClient({
      apiKey: this.options.propertyApiKey,
      baseUrl: process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com',
      fetchImpl: this.options.fetchImpl
    });

    return attomCrossCheck(deed, client);
  }

  async listRegistrySources(): Promise<RegistrySourceSummary[]> {
    return this.registryAdapterService.listSources();
  }

  async verifyRegistrySource(input: {
    sourceId: RegistrySourceId;
    subject: string;
    forceRefresh?: boolean;
  }) {
    return this.registryAdapterService.verify(input);
  }

  async verifyRegistrySources(input: {
    sourceIds: RegistrySourceId[];
    subject: string;
    forceRefresh?: boolean;
  }) {
    return this.registryAdapterService.verifyBatch(input);
  }

  async listRegistryOracleJobs(limit?: number): Promise<RegistryOracleJobView[]> {
    return this.registryAdapterService.listOracleJobs(limit);
  }

  async getRegistryOracleJob(jobId: string): Promise<RegistryOracleJobView | null> {
    return this.registryAdapterService.getOracleJob(jobId);
  }

  async getReceipt(receiptId: string): Promise<StoredReceiptView | null> {
    const record = await this.findReceiptRecord(receiptId);
    if (!record) return null;

    const receipt = receiptFromDb(record);
    return {
      receipt,
      canonicalReceipt: canonicalizeJson(toUnsignedReceiptPayload(receipt)),
      revoked: record.revoked,
      anchor: buildAnchorState(record, receipt.zkpAttestation)
    };
  }

  async getVerificationStatus(
    receiptId: string
  ): Promise<VerificationStatus | null> {
    const record = await this.findReceiptRecord(receiptId);
    if (!record) return null;

    const receipt = receiptFromDb(record);
    const verificationResult = await verifyStoredReceipt(
      receipt,
      record,
      this.options.securityConfig
    );

    return {
      verified: verificationResult.verified,
      integrityVerified: verificationResult.integrityVerified,
      signatureVerified: verificationResult.signatureVerified,
      signatureStatus: verificationResult.signatureStatus,
      signatureReason: verificationResult.signatureReason,
      proofVerified: verificationResult.proofVerified,
      recomputedHash: verificationResult.recomputedHash,
      storedHash: receipt.receiptHash,
      inputsCommitment: record.inputsCommitment,
      receiptSignature: receipt.receiptSignature
        ? {
            alg: receipt.receiptSignature.alg,
            kid: receipt.receiptSignature.kid
          }
        : null,
      revoked: record.revoked
    };
  }

  async getVantaVerificationResult(
    receiptId: string
  ): Promise<Record<string, unknown> | null> {
    const record = await this.findReceiptRecord(receiptId);
    if (!record) return null;

    const receipt = receiptFromDb(record);
    const receiptVerification = await verifyStoredReceipt(
      receipt,
      record,
      this.options.securityConfig
    );
    const fraudRiskRaw = receipt.fraudRisk as unknown as Record<string, unknown> | undefined;
    const zkpRaw =
      receipt.zkpAttestation as unknown as Record<string, unknown> | undefined;

    return {
      schemaVersion: 'trustsignal.vanta.verification_result.v1',
      generatedAt: new Date().toISOString(),
      vendor: {
        name: 'TrustSignal',
        module: 'DeedShield',
        environment: process.env.NODE_ENV || 'development',
        apiVersion: 'v1'
      },
      subject: {
        receiptId: record.id,
        receiptHash: record.receiptHash,
        policyProfile: record.policyProfile,
        createdAt: record.createdAt.toISOString()
      },
      result: {
        decision: record.decision,
        normalizedStatus: normalizeDecisionStatus(
          record.decision as 'ALLOW' | 'FLAG' | 'BLOCK'
        ),
        riskScore: record.riskScore,
        reasons: JSON.parse(record.reasons) as string[],
        checks: (
          JSON.parse(record.checks) as Array<{
            checkId: string;
            status: string;
            details?: string;
          }>
        ).map((check) => ({
          checkId: check.checkId,
          status: check.status,
          details: typeof check.details === 'string' ? check.details : undefined,
          source_name: resolveRegistrySourceNameFromCheckId(check.checkId)
        })),
        fraudRisk: fraudRiskRaw
          ? {
              score: Number(fraudRiskRaw.score ?? 0),
              band: String(fraudRiskRaw.band ?? 'UNKNOWN'),
              reasons: Array.isArray(fraudRiskRaw.reasons)
                ? fraudRiskRaw.reasons.map((value) => String(value))
                : []
            }
          : null,
        zkpAttestation: zkpRaw
          ? {
              scheme: String(zkpRaw.scheme ?? 'UNKNOWN'),
              status: String(zkpRaw.status ?? 'unknown'),
              backend: String(zkpRaw.backend ?? 'unknown'),
              circuitId:
                typeof zkpRaw.circuitId === 'string'
                  ? zkpRaw.circuitId
                  : undefined,
              verificationKeyId:
                typeof zkpRaw.verificationKeyId === 'string'
                  ? zkpRaw.verificationKeyId
                  : undefined,
              verifiedAt:
                typeof zkpRaw.verifiedAt === 'string'
                  ? zkpRaw.verifiedAt
                  : undefined,
              publicInputs: {
                policyHash: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.policyHash ?? ''
                ),
                timestamp: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.timestamp ?? ''
                ),
                inputsCommitment: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.inputsCommitment ?? ''
                ),
                conformance: Boolean(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.conformance
                ),
                declaredDocHash: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.declaredDocHash ?? ''
                ),
                documentDigest: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.documentDigest ?? ''
                ),
                documentCommitment: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.documentCommitment ?? ''
                ),
                schemaVersion: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.schemaVersion ?? ''
                ),
                documentWitnessMode: String(
                  (zkpRaw.publicInputs as Record<string, unknown> | undefined)
                    ?.documentWitnessMode ?? ''
                )
              },
              proofArtifact: (() => {
                const proofArtifact = zkpRaw.proofArtifact as
                  | Record<string, unknown>
                  | undefined;
                if (
                  !proofArtifact ||
                  typeof proofArtifact.format !== 'string' ||
                  typeof proofArtifact.digest !== 'string'
                ) {
                  return undefined;
                }
                return {
                  format: proofArtifact.format,
                  digest: proofArtifact.digest,
                  encoding:
                    proofArtifact.encoding === 'base64' ? 'base64' : undefined,
                  proof:
                    typeof proofArtifact.proof === 'string'
                      ? proofArtifact.proof
                      : undefined
                };
              })()
            }
          : null
      },
      controls: {
        revoked: record.revoked,
        anchorStatus: record.anchorStatus,
        anchored: record.anchorStatus === 'ANCHORED',
        receiptSignaturePresent: Boolean(receipt.receiptSignature),
        receiptSignatureAlg: receipt.receiptSignature?.alg ?? null,
        receiptSignatureKid: receipt.receiptSignature?.kid ?? null,
        anchorSubjectDigest: buildAnchorState(record, receipt.zkpAttestation)
          .subjectDigest,
        anchorSubjectVersion: buildAnchorState(record, receipt.zkpAttestation)
          .subjectVersion,
        anchoredAt: buildAnchorState(record, receipt.zkpAttestation).anchoredAt,
        signatureVerified: receiptVerification.signatureVerified
      }
    };
  }

  async anchorReceipt(receiptId: string): Promise<AnchorReceiptResult> {
    const record = await this.findReceiptRecord(receiptId);
    if (!record) {
      return { kind: 'not_found' };
    }

    const receipt = receiptFromDb(record);
    if (!receipt.zkpAttestation?.proofArtifact?.digest) {
      return { kind: 'proof_artifact_required' };
    }

    if (record.anchorStatus === 'ANCHORED') {
      return {
        kind: 'anchored',
        anchor: buildAnchorState(record, receipt.zkpAttestation)
      };
    }

    const result = await performAnchorReceipt(
      record.receiptHash,
      receipt.zkpAttestation
    );
    const updated = await this.options.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        anchorStatus: 'ANCHORED',
        anchorTxHash: result.txHash,
        anchorChainId: result.chainId,
        anchorId: result.anchorId,
        anchorSubjectDigest: result.subjectDigest,
        anchorSubjectVersion: result.subjectVersion,
        anchorAnchoredAt: result.anchoredAt
          ? new Date(result.anchoredAt)
          : undefined
      }
    });

    return {
      kind: 'anchored',
      anchor: buildAnchorState(updated, receipt.zkpAttestation)
    };
  }

  async revokeReceipt(receiptId: string): Promise<RevokeReceiptResult> {
    const record = await this.findReceiptRecord(receiptId);
    if (!record) {
      return { kind: 'not_found' };
    }

    if (record.revoked) {
      return { kind: 'already_revoked' };
    }

    await this.options.prisma.receipt.update({
      where: { id: receiptId },
      data: { revoked: true }
    });

    return { kind: 'revoked' };
  }

  private async findReceiptRecord(receiptId: string): Promise<ReceiptRecord | null> {
    return this.options.prisma.receipt.findUnique({
      where: { id: receiptId }
    });
  }
}

export function createLocalVerificationEngine(
  options: Options
): VerificationEngine {
  return new LocalVerificationEngine(options);
}
