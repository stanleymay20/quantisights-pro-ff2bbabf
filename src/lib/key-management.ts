import { SIGNING_ALGORITHM, type SigningAlgorithm, type SigningPurpose } from "@/lib/crypto-signing-types";
import {
  KeyProviderError,
  KeyProviderNotImplementedError,
  type CreateSigningKeyInput,
  type KeyProvider,
  type KeyStatus,
  type SigningKeyMetadata,
} from "@/lib/key-management-types";

/**
 * GA-3 — Key providers.
 *
 * All providers here generate/import REAL Ed25519 keys via WebCrypto
 * (`globalThis.crypto.subtle`) — never a placeholder or deterministic
 * "fake" keypair. What differs between providers is *where private key
 * material lives*, not whether the cryptography is real.
 */

const webcrypto = globalThis.crypto;

async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return (await webcrypto.subtle.generateKey({ name: SIGNING_ALGORITHM }, true, ["sign", "verify"])) as CryptoKeyPair;
}

async function exportPublicKeyBase64Url(publicKey: CryptoKey): Promise<string> {
  const spki = await webcrypto.subtle.exportKey("spki", publicKey);
  return bufferToBase64Url(spki);
}

async function importPublicKeyFromBase64Url(publicKeyBase64Url: string): Promise<CryptoKey> {
  const spki = base64UrlToBuffer(publicKeyBase64Url);
  return webcrypto.subtle.importKey("spki", spki, { name: SIGNING_ALGORITHM }, true, ["verify"]);
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function deriveKeyId(purpose: SigningPurpose, environment: string, createdAt: string, publicKeyBase64Url: string): string {
  // Note: Ed25519 SPKI DER encoding has a fixed 12-byte ASN.1 header, so the
  // *leading* base64url characters of every Ed25519 public key are
  // identical — do not fingerprint from the start of the string. A random
  // component (rather than relying on any positional slice of the key
  // material) guarantees uniqueness regardless of encoding details, even
  // for two keys created in the same millisecond.
  void publicKeyBase64Url;
  const random = webcrypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `key-${purpose}-${environment}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${random}`;
}

interface StoredKey {
  metadata: SigningKeyMetadata;
  keyPair: CryptoKeyPair | null;
  /** Set when only the public half is known (e.g. EnvironmentKeyProvider
   *  loaded a verification-only key with no private_key_jwk). */
  publicKeyOnly: CryptoKey | null;
}

/**
 * Shared lifecycle/validity logic used by both in-process providers below.
 * Kept out of KeyProvider itself so it stays a pure interface other
 * (e.g. future KMS-backed) providers can implement independently.
 */
abstract class InProcessKeyProviderBase implements KeyProvider {
  protected readonly keys = new Map<string, StoredKey>();

  constructor(public readonly environment: string) {}

  async getActiveSigningKey(purpose: SigningPurpose): Promise<SigningKeyMetadata | null> {
    for (const stored of this.keys.values()) {
      if (stored.metadata.purpose === purpose && stored.metadata.status === "ACTIVE") return { ...stored.metadata };
    }
    return null;
  }

  async getVerificationKey(key_id: string): Promise<SigningKeyMetadata | null> {
    const stored = this.keys.get(key_id);
    return stored ? { ...stored.metadata } : null;
  }

  async listVerificationKeys(purpose?: SigningPurpose): Promise<SigningKeyMetadata[]> {
    return [...this.keys.values()]
      .filter((stored) => stored.metadata.status !== "PENDING" && (!purpose || stored.metadata.purpose === purpose))
      .map((stored) => ({ ...stored.metadata }));
  }

  async signWithKey(key_id: string, data: Uint8Array): Promise<Uint8Array> {
    const stored = this.keys.get(key_id);
    if (!stored) throw new KeyProviderError(`unknown signing key ${key_id}`);
    if (stored.metadata.status !== "ACTIVE") {
      throw new KeyProviderError(`key ${key_id} is ${stored.metadata.status}, not ACTIVE — cannot sign`);
    }
    if (!stored.keyPair) throw new KeyProviderError(`key ${key_id} has no private key material available for signing`);
    const signature = await webcrypto.subtle.sign({ name: SIGNING_ALGORITHM }, stored.keyPair.privateKey, data as BufferSource);
    return new Uint8Array(signature);
  }

  async verifyWithKey(key_id: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const stored = this.keys.get(key_id);
    if (!stored) return false;
    const publicKey = stored.keyPair?.publicKey ?? stored.publicKeyOnly;
    if (!publicKey) return false;
    return webcrypto.subtle.verify({ name: SIGNING_ALGORITHM }, publicKey, signature as BufferSource, data as BufferSource);
  }

  async isKeyValidAt(key_id: string, at: string): Promise<boolean> {
    const stored = this.keys.get(key_id);
    if (!stored) return false;
    const meta = stored.metadata;
    if (meta.status === "REVOKED" || meta.status === "PENDING") return false;
    if (meta.status === "EXPIRED") return false;
    if (meta.activated_at === null || at < meta.activated_at) return false;
    if (meta.expires_at !== null && at > meta.expires_at) return false;
    return true;
  }

  async rotateSigningKey(purpose: SigningPurpose, now: string): Promise<SigningKeyMetadata> {
    const currentActive = await this.getActiveSigningKey(purpose);
    const created = await this.createKey({ purpose, environment: this.environment, now, rotation_parent_key_id: currentActive?.key_id ?? null });
    if (currentActive) await this.retireKey(currentActive.key_id, now);
    return this.activatePendingKey(created.key_id, now);
  }

  async revokeSigningKey(key_id: string, reason: string, now: string): Promise<SigningKeyMetadata> {
    const stored = this.requireStored(key_id);
    stored.metadata = { ...stored.metadata, status: "REVOKED", revoked_at: now, revocation_reason: reason };
    return { ...stored.metadata };
  }

  async retireKey(key_id: string, now: string): Promise<SigningKeyMetadata> {
    const stored = this.requireStored(key_id);
    if (stored.metadata.status !== "ACTIVE") return { ...stored.metadata };
    stored.metadata = { ...stored.metadata, status: "RETIRED", retired_at: now };
    return { ...stored.metadata };
  }

  async activatePendingKey(key_id: string, now: string): Promise<SigningKeyMetadata> {
    const stored = this.requireStored(key_id);
    if (stored.metadata.status !== "PENDING") {
      throw new KeyProviderError(`key ${key_id} is ${stored.metadata.status}, not PENDING — cannot activate`);
    }
    const currentActive = await this.getActiveSigningKey(stored.metadata.purpose);
    if (currentActive && currentActive.key_id !== key_id) await this.retireKey(currentActive.key_id, now);
    stored.metadata = { ...stored.metadata, status: "ACTIVE", activated_at: now };
    return { ...stored.metadata };
  }

  /** Marks any keys past their expires_at as EXPIRED. Call before relying
   *  on status snapshots (isKeyValidAt already checks expires_at directly,
   *  so this is only needed for status-listing accuracy). */
  sweepExpired(now: string): void {
    for (const stored of this.keys.values()) {
      if (stored.metadata.status === "ACTIVE" || stored.metadata.status === "RETIRED") {
        if (stored.metadata.expires_at !== null && now > stored.metadata.expires_at) {
          stored.metadata = { ...stored.metadata, status: "EXPIRED" };
        }
      }
    }
  }

  protected requireStored(key_id: string): StoredKey {
    const stored = this.keys.get(key_id);
    if (!stored) throw new KeyProviderError(`unknown key ${key_id}`);
    return stored;
  }

  protected abstract createKey(input: CreateSigningKeyInput): Promise<SigningKeyMetadata>;
}

/**
 * NON-PRODUCTION. Generates and holds real Ed25519 keys entirely in
 * process memory — private key material never leaves this object, but it
 * also never survives a process restart and is never shared across
 * processes/instances. Suitable for deterministic tests and local/dev use
 * only. Do not use for any environment where signed artifacts must remain
 * verifiable after a restart or across multiple runtime instances.
 */
export class InMemoryKeyProvider extends InProcessKeyProviderBase {
  protected async createKey(input: CreateSigningKeyInput): Promise<SigningKeyMetadata> {
    const keyPair = await generateEd25519KeyPair();
    const publicKeyBase64Url = await exportPublicKeyBase64Url(keyPair.publicKey);
    const key_id = deriveKeyId(input.purpose, input.environment, input.now, publicKeyBase64Url);
    const metadata: SigningKeyMetadata = {
      key_id,
      purpose: input.purpose,
      algorithm: SIGNING_ALGORITHM,
      status: "PENDING",
      public_key: publicKeyBase64Url,
      environment: input.environment,
      created_at: input.now,
      activated_at: null,
      expires_at: input.expires_at ?? null,
      retired_at: null,
      revoked_at: null,
      revocation_reason: null,
      rotation_parent_key_id: input.rotation_parent_key_id ?? null,
      metadata: input.metadata ?? {},
    };
    this.keys.set(key_id, { metadata, keyPair, publicKeyOnly: null });
    return { ...metadata };
  }

  /** Convenience for tests/bootstrap: create + immediately activate. */
  async createAndActivateKey(input: CreateSigningKeyInput): Promise<SigningKeyMetadata> {
    const created = await this.createKey(input);
    return this.activatePendingKey(created.key_id, input.now);
  }
}

export interface EnvironmentSigningKeyRecord {
  key_id: string;
  purpose: SigningPurpose;
  algorithm: SigningAlgorithm;
  status: KeyStatus;
  environment: string;
  created_at: string;
  activated_at: string | null;
  expires_at?: string | null;
  retired_at?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  rotation_parent_key_id?: string | null;
  metadata?: Record<string, unknown>;
  /** JWK-encoded public key (always present). */
  public_key_jwk: JsonWebKey;
  /** JWK-encoded private key. Omitted for verification-only entries — such
   *  a key can verify historical signatures but signWithKey() will throw. */
  private_key_jwk?: JsonWebKey;
}

export interface EnvironmentKeyProviderConfig {
  environment: string;
  /**
   * JSON-encoded array of EnvironmentSigningKeyRecord, injected by the
   * caller (e.g. from `process.env.GA3_SIGNING_KEYS_JSON` in an edge
   * function, or a secrets manager value). This class never reads
   * process.env directly and never logs the raw value.
   */
  keys_json: string;
}

/**
 * Loads key material from injected configuration rather than generating
 * it. Intended for environments where key material is provisioned
 * out-of-band (e.g. a deploy-time secret) and handed to the process as a
 * single opaque JSON blob. Rotation still works, but — unlike a real
 * KMS — a newly rotated key exists only in this process's memory until
 * the operator updates the injected secret for other instances/restarts.
 * Never call with hardcoded key material; `keys_json` must come from an
 * injected secret, and is never printed or logged by this class.
 */
export class EnvironmentKeyProvider extends InProcessKeyProviderBase {
  constructor(config: EnvironmentKeyProviderConfig) {
    super(config.environment);
    this.loadFromJson(config.keys_json);
  }

  private loadFromJson(keysJson: string): void {
    let records: EnvironmentSigningKeyRecord[];
    try {
      records = JSON.parse(keysJson);
    } catch {
      throw new KeyProviderError("EnvironmentKeyProvider: keys_json is not valid JSON");
    }
    if (!Array.isArray(records)) {
      throw new KeyProviderError("EnvironmentKeyProvider: keys_json must be a JSON array of key records");
    }
    for (const record of records) {
      this.keys.set(record.key_id, {
        metadata: {
          key_id: record.key_id,
          purpose: record.purpose,
          algorithm: record.algorithm,
          status: record.status,
          public_key: "", // populated once imported, below
          environment: record.environment,
          created_at: record.created_at,
          activated_at: record.activated_at ?? null,
          expires_at: record.expires_at ?? null,
          retired_at: record.retired_at ?? null,
          revoked_at: record.revoked_at ?? null,
          revocation_reason: record.revocation_reason ?? null,
          rotation_parent_key_id: record.rotation_parent_key_id ?? null,
          metadata: record.metadata ?? {},
        },
        keyPair: null,
        publicKeyOnly: null,
      });
    }
    // Import key material asynchronously; callers must await ready() before use.
    this.readyPromise = this.importAll(records);
  }

  private readyPromise: Promise<void> = Promise.resolve();

  /** Environment-loaded keys are imported asynchronously (WebCrypto import
   *  is async); await this before the first sign/verify call. */
  async ready(): Promise<void> {
    return this.readyPromise;
  }

  private async importAll(records: EnvironmentSigningKeyRecord[]): Promise<void> {
    for (const record of records) {
      const stored = this.keys.get(record.key_id);
      if (!stored) continue;
      const publicKey = await webcrypto.subtle.importKey("jwk", record.public_key_jwk, { name: SIGNING_ALGORITHM }, true, ["verify"]);
      const publicKeyBase64Url = await exportPublicKeyBase64Url(publicKey);
      if (record.private_key_jwk) {
        const privateKey = await webcrypto.subtle.importKey("jwk", record.private_key_jwk, { name: SIGNING_ALGORITHM }, true, ["sign"]);
        stored.keyPair = { publicKey, privateKey };
      } else {
        stored.publicKeyOnly = publicKey;
      }
      stored.metadata = { ...stored.metadata, public_key: publicKeyBase64Url };
    }
  }

  protected async createKey(input: CreateSigningKeyInput): Promise<SigningKeyMetadata> {
    // Rotation on an environment-sourced provider still generates a real,
    // in-process key (documented limitation: it will not survive a
    // restart unless the operator persists it back into the injected
    // configuration for other instances).
    const keyPair = await generateEd25519KeyPair();
    const publicKeyBase64Url = await exportPublicKeyBase64Url(keyPair.publicKey);
    const key_id = deriveKeyId(input.purpose, input.environment, input.now, publicKeyBase64Url);
    const metadata: SigningKeyMetadata = {
      key_id,
      purpose: input.purpose,
      algorithm: SIGNING_ALGORITHM,
      status: "PENDING",
      public_key: publicKeyBase64Url,
      environment: input.environment,
      created_at: input.now,
      activated_at: null,
      expires_at: input.expires_at ?? null,
      retired_at: null,
      revoked_at: null,
      revocation_reason: null,
      rotation_parent_key_id: input.rotation_parent_key_id ?? null,
      metadata: { ...(input.metadata ?? {}), rotation_note: "generated in-process; not persisted to injected configuration" },
    };
    this.keys.set(key_id, { metadata, keyPair, publicKeyOnly: null });
    return { ...metadata };
  }
}

/**
 * Compile-only adapter boundary for a real KMS/Vault (Supabase Vault, AWS
 * KMS, Google Cloud KMS, Azure Key Vault). No cloud SDK dependency is
 * added — none is already present in this repository's dependencies, and
 * GA-3 does not have a real KMS environment to validate against (see
 * docs/architecture/GA-3-Cryptographic-Signing.md). Every method throws
 * KeyProviderNotImplementedError, mirroring the same honest-scaffold
 * pattern GA-2 used for SupabaseRuntimePersistence/PostgresRuntimePersistence
 * before they were implemented against a real environment.
 */
export interface KmsKeyProviderConfig {
  environment: string;
  /** e.g. "supabase-vault" | "aws-kms" | "gcp-kms" | "azure-key-vault" — informational only. */
  provider_name: string;
}

export class KmsKeyProviderScaffold implements KeyProvider {
  public readonly environment: string;
  private readonly providerName: string;

  constructor(config: KmsKeyProviderConfig) {
    this.environment = config.environment;
    this.providerName = config.provider_name;
  }

  async getActiveSigningKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).getActiveSigningKey`);
  }

  async getVerificationKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).getVerificationKey`);
  }

  async listVerificationKeys(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).listVerificationKeys`);
  }

  async signWithKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).signWithKey`);
  }

  async verifyWithKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).verifyWithKey`);
  }

  async rotateSigningKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).rotateSigningKey`);
  }

  async revokeSigningKey(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).revokeSigningKey`);
  }

  async isKeyValidAt(): Promise<never> {
    throw new KeyProviderNotImplementedError(`KmsKeyProviderScaffold(${this.providerName}).isKeyValidAt`);
  }
}
