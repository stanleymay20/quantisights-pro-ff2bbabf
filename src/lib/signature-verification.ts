import { z } from "zod";

import {
  canonicalPayloadHash,
  createCryptoSigningAdapter,
  type CryptoSigningAdapter,
} from "@/lib/crypto-signing";
import {
  SIGNING_ALGORITHM,
  SIGNING_PURPOSES,
  SignatureBlockSchema,
  type SignedEnvelope,
  type SigningAlgorithm,
  type SigningPurpose,
} from "@/lib/crypto-signing-types";
import type { KeyProvider } from "@/lib/key-management-types";

/**
 * GA-3 — Framework-agnostic signature verification service.
 *
 * Used identically by: the Agent Gateway (decision tokens), the Runtime
 * Gateway (acknowledgements), the Evidence Pack (signed manifests), and
 * the supabase/functions/verify-signed-artifact edge function. No caller
 * ever sees or handles private key material here — only public
 * SigningKeyMetadata resolved through the injected KeyProvider.
 */

export const INVALID_REASONS = [
  "SIGNATURE_INVALID",
  "KEY_NOT_FOUND",
  "KEY_REVOKED",
  "KEY_EXPIRED",
  "ARTIFACT_EXPIRED",
  "PURPOSE_MISMATCH",
  "TENANT_MISMATCH",
  "ORGANIZATION_MISMATCH",
  "PAYLOAD_TAMPERED",
  "UNSUPPORTED_ALGORITHM",
  "UNSUPPORTED_SCHEMA",
  "MALFORMED_ARTIFACT",
] as const;
export type InvalidReason = (typeof INVALID_REASONS)[number];

export interface VerificationResult {
  valid: boolean;
  invalid_reason: InvalidReason | null;
  key_id: string | null;
  algorithm: SigningAlgorithm | null;
  purpose: SigningPurpose | null;
  issued_at: string | null;
  expires_at: string | null;
  payload_hash: string | null;
  verification_timestamp: string;
  schema_version: string | null;
}

const DEFAULT_MAX_ARTIFACT_BYTES = 65_536;

const GenericEnvelopeSchema = z.object({
  payload: z.record(z.unknown()),
  signature: SignatureBlockSchema,
});

export interface VerifyOptions {
  expected_purpose: SigningPurpose;
  /** If the payload carries tenant_id/organization_id, pass the caller's
   *  expected values to enforce a match (TENANT_MISMATCH/ORGANIZATION_MISMATCH). */
  expected_tenant_id?: string;
  expected_organization_id?: string;
  /** Optional stricter payload shape check beyond the generic envelope. */
  payload_schema?: z.ZodTypeAny;
}

export interface VerificationService {
  verifySignedEnvelope(rawArtifact: unknown, options: VerifyOptions): Promise<VerificationResult>;
  verifyDecisionToken(rawArtifact: unknown, options?: Omit<VerifyOptions, "expected_purpose" | "payload_schema">): Promise<VerificationResult>;
  verifyRuntimeAcknowledgement(rawArtifact: unknown, options?: Omit<VerifyOptions, "expected_purpose" | "payload_schema">): Promise<VerificationResult>;
  verifyEvidencePackManifest(rawArtifact: unknown, options?: Omit<VerifyOptions, "expected_purpose" | "payload_schema">): Promise<VerificationResult>;
}

export interface VerificationServiceConfig {
  keyProvider: KeyProvider;
  now?: () => string;
  max_artifact_bytes?: number;
  signingAdapter?: CryptoSigningAdapter;
}

// .passthrough() is required, not cosmetic: the canonical payload that was
// actually signed is *every* field the signer included. If this schema
// stripped unrecognized fields (zod's default for z.object()), the
// re-canonicalized payload here would differ byte-for-byte from what was
// signed and every otherwise-valid artifact would fail as PAYLOAD_TAMPERED.
// These schemas exist to assert required fields are present/typed, not to
// act as an allow-list that mutates the payload before verification.
const DecisionTokenPayloadSchema = z
  .object({
    token_schema_version: z.string().min(1),
    decision_id: z.string().min(1),
    decision_record_hash: z.string().min(1),
    tenant_id: z.string().min(1),
    organization_id: z.string().min(1),
    policy_id: z.string().min(1),
    policy_version: z.string().min(1),
    approval_state: z.string().min(1),
    issued_at: z.string().min(1),
    expiry: z.string().min(1),
    required_approvers: z.array(z.string()),
  })
  .passthrough();

const RuntimeAcknowledgementPayloadSchema = z
  .object({
    acknowledgement_id: z.string().min(1),
    correlation_id: z.string().min(1),
    request_hash: z.string().min(1),
    tenant_id: z.string().min(1),
    organization_id: z.string().min(1),
    gateway_version: z.string().min(1),
    runtime_version: z.string().min(1),
    schema_version: z.string().min(1),
    status: z.string().min(1),
    received_at: z.string().min(1),
  })
  .passthrough();

const EvidencePackManifestPayloadSchema = z
  .object({
    evidence_pack_schema_version: z.string().min(1),
    evidence_pack_hash: z.string().min(1),
    decision_id: z.string().min(1),
    organization_id: z.string().nullable(),
    generated_at: z.string().min(1),
  })
  .passthrough();

export function createVerificationService(config: VerificationServiceConfig): VerificationService {
  const now = () => config.now?.() ?? new Date().toISOString();
  const maxBytes = config.max_artifact_bytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  const signingAdapter = config.signingAdapter ?? createCryptoSigningAdapter(config.keyProvider);

  async function verifySignedEnvelope(rawArtifact: unknown, options: VerifyOptions): Promise<VerificationResult> {
    const verificationTimestamp = now();
    const empty = (invalid_reason: InvalidReason, extra: Partial<VerificationResult> = {}): VerificationResult => ({
      valid: false,
      invalid_reason,
      key_id: null,
      algorithm: null,
      purpose: null,
      issued_at: null,
      expires_at: null,
      payload_hash: null,
      verification_timestamp: verificationTimestamp,
      schema_version: null,
      ...extra,
    });

    let serializedLength: number;
    try {
      serializedLength = new TextEncoder().encode(JSON.stringify(rawArtifact)).length;
    } catch {
      return empty("MALFORMED_ARTIFACT");
    }
    if (serializedLength > maxBytes) {
      return empty("MALFORMED_ARTIFACT");
    }

    const shapeSchema = options.payload_schema
      ? z.object({ payload: options.payload_schema, signature: SignatureBlockSchema })
      : GenericEnvelopeSchema;
    const parsed = shapeSchema.safeParse(rawArtifact);
    if (!parsed.success) return empty("MALFORMED_ARTIFACT");
    const envelope = parsed.data as SignedEnvelope<Record<string, any>>;

    if (envelope.signature.algorithm !== SIGNING_ALGORITHM) {
      return empty("UNSUPPORTED_ALGORITHM", { key_id: envelope.signature.key_id });
    }
    if (!SIGNING_PURPOSES.includes(envelope.signature.purpose)) {
      return empty("UNSUPPORTED_SCHEMA", { key_id: envelope.signature.key_id });
    }
    if (envelope.signature.purpose !== options.expected_purpose) {
      return empty("PURPOSE_MISMATCH", {
        key_id: envelope.signature.key_id,
        algorithm: envelope.signature.algorithm,
        purpose: envelope.signature.purpose,
      });
    }

    const payloadHash = await canonicalPayloadHash(envelope.payload).catch(() => null);
    const baseFields: Partial<VerificationResult> = {
      key_id: envelope.signature.key_id,
      algorithm: envelope.signature.algorithm,
      purpose: envelope.signature.purpose,
      issued_at: envelope.signature.issued_at,
      payload_hash: payloadHash,
      schema_version: envelope.signature.schema_version,
    };

    if (options.expected_tenant_id !== undefined && typeof envelope.payload.tenant_id === "string") {
      if (envelope.payload.tenant_id !== options.expected_tenant_id) {
        return empty("TENANT_MISMATCH", baseFields);
      }
    }
    if (options.expected_organization_id !== undefined && typeof envelope.payload.organization_id === "string") {
      if (envelope.payload.organization_id !== options.expected_organization_id) {
        return empty("ORGANIZATION_MISMATCH", baseFields);
      }
    }

    const keyMetadata = await config.keyProvider.getVerificationKey(envelope.signature.key_id);
    if (!keyMetadata) return empty("KEY_NOT_FOUND", baseFields);
    if (keyMetadata.status === "REVOKED") return empty("KEY_REVOKED", baseFields);
    if (keyMetadata.status === "EXPIRED") return empty("KEY_EXPIRED", baseFields);
    const keyValidAtIssuance = await config.keyProvider.isKeyValidAt(envelope.signature.key_id, envelope.signature.issued_at);
    if (!keyValidAtIssuance) return empty("KEY_EXPIRED", baseFields);

    const artifactExpiry = extractExpiry(envelope.payload);
    if (artifactExpiry) {
      baseFields.expires_at = artifactExpiry;
      if (verificationTimestamp > artifactExpiry) return empty("ARTIFACT_EXPIRED", baseFields);
    }

    let cryptoValid: boolean;
    try {
      cryptoValid = await signingAdapter.verifyCanonicalPayload(envelope);
    } catch {
      return empty("SIGNATURE_INVALID", baseFields);
    }
    if (!cryptoValid) return empty("PAYLOAD_TAMPERED", baseFields);

    return {
      valid: true,
      invalid_reason: null,
      key_id: envelope.signature.key_id,
      algorithm: envelope.signature.algorithm,
      purpose: envelope.signature.purpose,
      issued_at: envelope.signature.issued_at,
      expires_at: artifactExpiry,
      payload_hash: payloadHash,
      verification_timestamp: verificationTimestamp,
      schema_version: envelope.signature.schema_version,
    };
  }

  return {
    verifySignedEnvelope,
    verifyDecisionToken: (rawArtifact, options = {}) =>
      verifySignedEnvelope(rawArtifact, { ...options, expected_purpose: "decision_token", payload_schema: DecisionTokenPayloadSchema }),
    verifyRuntimeAcknowledgement: (rawArtifact, options = {}) =>
      verifySignedEnvelope(rawArtifact, { ...options, expected_purpose: "runtime_acknowledgement", payload_schema: RuntimeAcknowledgementPayloadSchema }),
    verifyEvidencePackManifest: (rawArtifact, options = {}) =>
      verifySignedEnvelope(rawArtifact, { ...options, expected_purpose: "evidence_pack", payload_schema: EvidencePackManifestPayloadSchema }),
  };
}

function extractExpiry(payload: Record<string, unknown>): string | null {
  const candidate = payload.expiry ?? payload.expires_at;
  return typeof candidate === "string" ? candidate : null;
}
