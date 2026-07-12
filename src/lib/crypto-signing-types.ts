import { z } from "zod";

/**
 * GA-3 — Enterprise Cryptographic Signing.
 *
 * Real asymmetric signing over deterministic, canonical payloads. Every
 * type in this module is shared by the signing side (crypto-signing.ts,
 * key-management.ts) and the verification side (signature-verification.ts)
 * so a signed artifact produced by one is exactly what the other expects.
 */

export const CRYPTO_SIGNING_SCHEMA_VERSION = "quantivis.crypto-signing.v1";

/**
 * Ed25519 only. WebCrypto (`globalThis.crypto.subtle`) implements Ed25519
 * natively in Node 20+, Deno (stable since 1.35), and modern browsers —
 * verified against this runtime's Node 22 before choosing it (see
 * docs/architecture/GA-3-Cryptographic-Signing.md for the exact
 * verification and the rationale over ECDSA P-256/RSA/HMAC). No fallback
 * algorithm is implemented because none was needed.
 */
export const SIGNING_ALGORITHM = "Ed25519" as const;
export type SigningAlgorithm = typeof SIGNING_ALGORITHM;

export const SIGNING_PURPOSES = [
  "decision_token",
  "runtime_acknowledgement",
  "evidence_pack",
  "audit_manifest",
] as const;
export type SigningPurpose = (typeof SIGNING_PURPOSES)[number];

/** A canonicalizable JSON value. Functions, symbols, undefined (nested),
 *  bigint, NaN/Infinity, and non-plain-object class instances (Date, Map,
 *  Set, ...) are all rejected by canonicalizePayload — they have no
 *  single canonical textual form a verifier could reproduce independently. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export class CanonicalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalizationError";
  }
}

/**
 * The block attached to every signed artifact. Never carries private key
 * material — only identifies which key/algorithm/purpose produced
 * `signature`, and when.
 */
export interface SignatureBlock {
  schema_version: typeof CRYPTO_SIGNING_SCHEMA_VERSION;
  key_id: string;
  algorithm: SigningAlgorithm;
  purpose: SigningPurpose;
  issued_at: string;
  /** Base64url-encoded raw Ed25519 signature bytes. */
  signature: string;
}

/** A signed artifact: the canonical payload plus the signature over it.
 *  `payload` must be exactly what was canonicalized and signed — the
 *  signature block itself is never part of the signed bytes. */
export interface SignedEnvelope<T extends Record<string, JsonValue>> {
  payload: T;
  signature: SignatureBlock;
}

export const SignatureBlockSchema = z.object({
  schema_version: z.literal(CRYPTO_SIGNING_SCHEMA_VERSION),
  key_id: z.string().min(1).max(200),
  algorithm: z.literal(SIGNING_ALGORITHM),
  purpose: z.enum(SIGNING_PURPOSES),
  issued_at: z.string().datetime({ offset: true }),
  signature: z.string().min(1).max(4096),
});

export function signedEnvelopeSchema<T extends z.ZodTypeAny>(payloadSchema: T) {
  return z.object({
    payload: payloadSchema,
    signature: SignatureBlockSchema,
  });
}
