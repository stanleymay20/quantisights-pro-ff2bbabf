import { z } from "zod";

import { SIGNING_ALGORITHM, SIGNING_PURPOSES, type SigningAlgorithm, type SigningPurpose } from "@/lib/crypto-signing-types";

/**
 * GA-3 — Key lifecycle and provider contracts (AG-3-key).
 *
 * PENDING  — generated but not yet the active signing key for its purpose.
 * ACTIVE   — the one key currently used to sign new artifacts for its
 *            purpose/environment. Exactly one per (purpose, environment).
 * RETIRED  — no longer signs, but remains valid for verifying artifacts it
 *            already signed (rotation never invalidates history).
 * REVOKED  — compromised/withdrawn. Fails verification by default.
 * EXPIRED  — past its validity window. Fails verification and cannot sign.
 */
export const KEY_STATUSES = ["PENDING", "ACTIVE", "RETIRED", "REVOKED", "EXPIRED"] as const;
export type KeyStatus = (typeof KEY_STATUSES)[number];

export interface SigningKeyMetadata {
  key_id: string;
  purpose: SigningPurpose;
  algorithm: SigningAlgorithm;
  status: KeyStatus;
  /** Base64url-encoded SPKI public key material. Never the private key. */
  public_key: string;
  environment: string;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  retired_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  /** key_id of the key this one was rotated from, if any. */
  rotation_parent_key_id: string | null;
  metadata: Record<string, unknown>;
}

export const SigningKeyMetadataSchema = z.object({
  key_id: z.string().min(1),
  purpose: z.enum(SIGNING_PURPOSES),
  algorithm: z.literal(SIGNING_ALGORITHM),
  status: z.enum(KEY_STATUSES),
  public_key: z.string().min(1),
  environment: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
  activated_at: z.string().datetime({ offset: true }).nullable(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  retired_at: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  revocation_reason: z.string().nullable(),
  rotation_parent_key_id: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export interface CreateSigningKeyInput {
  purpose: SigningPurpose;
  environment: string;
  now: string;
  /** If provided, the new key is created PENDING and only becomes ACTIVE
   *  once this timestamp is reached (future-dated activation). Defaults to
   *  activating immediately. */
  activate_at?: string;
  expires_at?: string | null;
  rotation_parent_key_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface KeyLifecycleAuditEvent {
  event_type:
    | "key.created"
    | "key.activated"
    | "key.rotated"
    | "key.retired"
    | "key.revoked"
    | "artifact.signed"
    | "artifact.verification_succeeded"
    | "artifact.verification_failed";
  key_id: string;
  purpose: SigningPurpose;
  algorithm: SigningAlgorithm;
  occurred_at: string;
  actor: string;
  artifact_id: string | null;
  artifact_hash: string | null;
  result: "success" | "failure";
  reason: string | null;
}

/**
 * Production-oriented signing/key-management contract (dependency-injected).
 * Every method that could touch private key material either never returns
 * it (getActiveSigningKey/getVerificationKey/listVerificationKeys only ever
 * return SigningKeyMetadata, which carries the *public* key) or performs
 * the private operation internally (signWithKey never returns the key,
 * only the resulting signature bytes).
 */
export interface KeyProvider {
  readonly environment: string;

  /** Metadata (public key only) for the current ACTIVE key for `purpose`. */
  getActiveSigningKey(purpose: SigningPurpose): Promise<SigningKeyMetadata | null>;
  /** Metadata (public key only) for any key by ID, active or not. */
  getVerificationKey(key_id: string): Promise<SigningKeyMetadata | null>;
  /** All keys for `purpose` (or every purpose if omitted) usable for verification, i.e. not PENDING. */
  listVerificationKeys(purpose?: SigningPurpose): Promise<SigningKeyMetadata[]>;

  /** Signs `data` with the named key's private material. The private key
   *  never leaves the provider. Throws if the key cannot sign right now
   *  (not ACTIVE, expired, revoked, or future-dated). */
  signWithKey(key_id: string, data: Uint8Array): Promise<Uint8Array>;
  /** Verifies `signature` over `data` with the named key's public material.
   *  Does not by itself enforce revocation/expiry policy — callers that
   *  need policy enforcement should also consult isKeyValidAt(). */
  verifyWithKey(key_id: string, data: Uint8Array, signature: Uint8Array): Promise<boolean>;

  /** Generates a new key for `purpose`, retires the previous ACTIVE key
   *  for that purpose (which remains valid for verification), and makes
   *  the new key ACTIVE. Never invalidates artifacts already signed by
   *  the retired key. */
  rotateSigningKey(purpose: SigningPurpose, now: string): Promise<SigningKeyMetadata>;
  /** Marks a key REVOKED. Revoked keys fail verification via isKeyValidAt(). */
  revokeSigningKey(key_id: string, reason: string, now: string): Promise<SigningKeyMetadata>;
  /** True iff the key was ACTIVE (or RETIRED, for verification purposes)
   *  and not expired/revoked as of `at`. Governs both "can this key sign
   *  right now" and "was this key valid when it signed/was used". */
  isKeyValidAt(key_id: string, at: string): Promise<boolean>;
}

export class KeyProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyProviderError";
  }
}

/** Thrown by any method a provider deliberately does not implement (e.g.
 *  the KMS scaffold, until GA-3R validates a real KMS/Vault). Mirrors the
 *  NotImplementedError pattern already established by GA-2's
 *  SupabaseRuntimePersistence/PostgresRuntimePersistence scaffolds. */
export class KeyProviderNotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} is not implemented; this key provider is a scaffold pending real KMS/Vault integration`);
    this.name = "KeyProviderNotImplementedError";
  }
}
