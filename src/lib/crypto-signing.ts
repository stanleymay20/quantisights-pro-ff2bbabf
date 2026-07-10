import {
  CRYPTO_SIGNING_SCHEMA_VERSION,
  CanonicalizationError,
  SIGNING_ALGORITHM,
  type JsonValue,
  type SignatureBlock,
  type SignedEnvelope,
  type SigningPurpose,
} from "@/lib/crypto-signing-types";
import { base64UrlToBuffer, bufferToBase64Url } from "@/lib/key-management";
import type { KeyProvider } from "@/lib/key-management-types";

/**
 * GA-3 — Canonical payload serialization and the payload-level signing
 * adapter (wraps a KeyProvider; never touches private key bytes directly —
 * KeyProvider.signWithKey/verifyWithKey do that).
 */

const textEncoder = new TextEncoder();

/**
 * Deterministic canonical JSON: object keys sorted recursively, array
 * order preserved exactly, and every value validated as plain JSON (no
 * functions, symbols, undefined, bigint, NaN/Infinity, or class instances
 * like Date/Map/Set — all of those have no single canonical textual form a
 * verifier could reproduce independently of this exact code path, so they
 * are rejected rather than silently coerced).
 */
export function canonicalizePayload(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, []));
}

function canonicalizeValue(value: unknown, path: string[]): JsonValue {
  if (value === null) return null;
  const type = typeof value;

  if (type === "boolean" || type === "string") return value as JsonValue;

  if (type === "number") {
    if (!Number.isFinite(value as number)) {
      throw new CanonicalizationError(`unsupported non-finite number at ${pathLabel(path)}`);
    }
    return value as number;
  }

  if (type === "undefined") throw new CanonicalizationError(`unsupported undefined value at ${pathLabel(path)}`);
  if (type === "function") throw new CanonicalizationError(`unsupported function value at ${pathLabel(path)}`);
  if (type === "symbol") throw new CanonicalizationError(`unsupported symbol value at ${pathLabel(path)}`);
  if (type === "bigint") throw new CanonicalizationError(`unsupported bigint value at ${pathLabel(path)}`);

  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalizeValue(entry, [...path, `[${index}]`]));
  }

  if (isPlainObject(value)) {
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const entryValue = (value as Record<string, unknown>)[key];
      if (entryValue === undefined) continue; // omit, do not error, matching JSON.stringify's own convention
      sorted[key] = canonicalizeValue(entryValue, [...path, key]);
    }
    return sorted;
  }

  throw new CanonicalizationError(
    `unsupported value of type ${value?.constructor?.name ?? type} at ${pathLabel(path)}; only plain objects, arrays, strings, finite numbers, booleans, and null are canonicalizable`,
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function pathLabel(path: string[]): string {
  return path.length === 0 ? "$" : `$.${path.join(".")}`;
}

export function sha256Hex(data: Uint8Array): Promise<string> {
  return globalThis.crypto.subtle.digest("SHA-256", data as BufferSource).then((digest) =>
    [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

/** SHA-256 over the canonical JSON form — used for payload_hash fields and
 *  tamper-evidence checks that don't themselves need a signature. */
export async function canonicalPayloadHash(value: unknown): Promise<string> {
  return sha256Hex(textEncoder.encode(canonicalizePayload(value)));
}

export interface SignCanonicalPayloadOptions {
  purpose: SigningPurpose;
  now: string;
}

export interface CryptoSigningAdapter {
  /** Canonicalizes `payload`, signs it with the active key for `purpose`,
   *  and returns the full signed envelope. Throws if there is no active,
   *  currently-valid signing key for `purpose`. */
  signCanonicalPayload<T extends Record<string, JsonValue>>(
    payload: T,
    options: SignCanonicalPayloadOptions,
  ): Promise<SignedEnvelope<T>>;
  /** Re-canonicalizes `envelope.payload`, resolves the key named in
   *  `envelope.signature.key_id`, and verifies the signature over it.
   *  Returns false for any structural problem (unknown key, wrong
   *  algorithm, tampered payload/signature) — never throws for those;
   *  it throws only for programmer errors (e.g. a non-canonicalizable
   *  payload). */
  verifyCanonicalPayload<T extends Record<string, JsonValue>>(envelope: SignedEnvelope<T>): Promise<boolean>;
}

/** Real Ed25519 signing adapter over an injected KeyProvider. This is the
 *  only implementation of CryptoSigningAdapter — there is no mock variant
 *  in production code; tests that need one inject an InMemoryKeyProvider
 *  (real Ed25519 keys, ephemeral storage) rather than faking the algorithm. */
export function createCryptoSigningAdapter(keyProvider: KeyProvider): CryptoSigningAdapter {
  return {
    async signCanonicalPayload(payload, options) {
      const activeKey = await keyProvider.getActiveSigningKey(options.purpose);
      if (!activeKey) {
        throw new Error(`no active signing key for purpose "${options.purpose}" in environment "${keyProvider.environment}"`);
      }
      const valid = await keyProvider.isKeyValidAt(activeKey.key_id, options.now);
      if (!valid) {
        throw new Error(`active signing key ${activeKey.key_id} for purpose "${options.purpose}" is not valid at ${options.now}`);
      }
      const canonicalBytes = textEncoder.encode(canonicalizePayload(payload));
      const signatureBytes = await keyProvider.signWithKey(activeKey.key_id, canonicalBytes);
      const signature: SignatureBlock = {
        schema_version: CRYPTO_SIGNING_SCHEMA_VERSION,
        key_id: activeKey.key_id,
        algorithm: SIGNING_ALGORITHM,
        purpose: options.purpose,
        issued_at: options.now,
        signature: bufferToBase64Url(signatureBytes.buffer as ArrayBuffer),
      };
      return { payload, signature };
    },

    async verifyCanonicalPayload(envelope) {
      if (envelope.signature.algorithm !== SIGNING_ALGORITHM) return false;
      if (envelope.signature.schema_version !== CRYPTO_SIGNING_SCHEMA_VERSION) return false;
      const canonicalBytes = textEncoder.encode(canonicalizePayload(envelope.payload));
      let signatureBytes: ArrayBuffer;
      try {
        signatureBytes = base64UrlToBuffer(envelope.signature.signature);
      } catch {
        return false;
      }
      try {
        return await keyProvider.verifyWithKey(envelope.signature.key_id, canonicalBytes, new Uint8Array(signatureBytes));
      } catch {
        return false;
      }
    },
  };
}
