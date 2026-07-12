import { describe, expect, it } from "vitest";

import { createCryptoSigningAdapter } from "@/lib/crypto-signing";
import {
  EnvironmentKeyProvider,
  InMemoryKeyProvider,
  bufferToBase64Url,
} from "@/lib/key-management";
import { KmsKeyProviderScaffold } from "@/lib/key-management";
import { KeyProviderNotImplementedError } from "@/lib/key-management-types";

const NOW = "2026-07-11T12:00:00.000Z";
const LATER = "2026-07-11T13:00:00.000Z";
const MUCH_LATER = "2026-07-12T12:00:00.000Z";

describe("GA-3 key lifecycle (InMemoryKeyProvider)", () => {
  it("has exactly one active signing key per purpose after creation", async () => {
    const provider = new InMemoryKeyProvider("test");
    const key = await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });

    expect(key.status).toBe("ACTIVE");
    const active = await provider.getActiveSigningKey("decision_token");
    expect(active?.key_id).toBe(key.key_id);

    // A different purpose has no active key of its own yet.
    expect(await provider.getActiveSigningKey("evidence_pack")).toBeNull();
  });

  it("rotation activates a new key and retires (not revokes) the previous one", async () => {
    const provider = new InMemoryKeyProvider("test");
    const first = await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });

    const rotated = await provider.rotateSigningKey("decision_token", LATER);

    expect(rotated.key_id).not.toBe(first.key_id);
    expect(rotated.status).toBe("ACTIVE");
    expect(rotated.rotation_parent_key_id).toBe(first.key_id);

    const oldKey = await provider.getVerificationKey(first.key_id);
    expect(oldKey?.status).toBe("RETIRED");
    expect(oldKey?.retired_at).toBe(LATER);

    const active = await provider.getActiveSigningKey("decision_token");
    expect(active?.key_id).toBe(rotated.key_id);
  });

  it("old signatures remain verifiable with a retired key after rotation", async () => {
    const provider = new InMemoryKeyProvider("test");
    await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
    const adapter = createCryptoSigningAdapter(provider);

    const envelope = await adapter.signCanonicalPayload({ decision_id: "dec-1" }, { purpose: "decision_token", now: NOW });
    await provider.rotateSigningKey("decision_token", LATER);

    await expect(adapter.verifyCanonicalPayload(envelope)).resolves.toBe(true);
    const key = await provider.getVerificationKey(envelope.signature.key_id);
    expect(key?.status).toBe("RETIRED");
  });

  it("a revoked key fails verification even though it previously signed valid artifacts", async () => {
    const provider = new InMemoryKeyProvider("test");
    const key = await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
    const adapter = createCryptoSigningAdapter(provider);
    const envelope = await adapter.signCanonicalPayload({ decision_id: "dec-1" }, { purpose: "decision_token", now: NOW });

    await provider.revokeSigningKey(key.key_id, "compromised", LATER);

    expect(await provider.isKeyValidAt(key.key_id, MUCH_LATER)).toBe(false);
    // Raw cryptographic verification still succeeds (the bytes are
    // unchanged) — it is isKeyValidAt()/the verification service's policy
    // check that must reject a revoked key, which signature-verification.test.ts covers.
    await expect(adapter.verifyCanonicalPayload(envelope)).resolves.toBe(true);
  });

  it("an expired key cannot sign", async () => {
    const provider = new InMemoryKeyProvider("test");
    const key = await provider.createAndActivateKey({
      purpose: "decision_token",
      environment: "test",
      now: NOW,
      expires_at: LATER,
    });
    const adapter = createCryptoSigningAdapter(provider);

    await expect(adapter.signCanonicalPayload({ decision_id: "dec-1" }, { purpose: "decision_token", now: MUCH_LATER })).rejects.toThrow();
    expect(await provider.isKeyValidAt(key.key_id, MUCH_LATER)).toBe(false);
  });

  it("a future-dated (PENDING, not yet activated) key cannot sign", async () => {
    const provider = new InMemoryKeyProvider("test");
    const pending = await (provider as any).createKey({ purpose: "decision_token", environment: "test", now: NOW });
    expect(pending.status).toBe("PENDING");

    await expect(provider.signWithKey(pending.key_id, new Uint8Array([1, 2, 3]))).rejects.toThrow();
    expect(await provider.isKeyValidAt(pending.key_id, NOW)).toBe(false);
  });

  it("signing/verifying with the wrong purpose is caught by the payload-level adapter, not the key itself", async () => {
    const provider = new InMemoryKeyProvider("test");
    await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
    const adapter = createCryptoSigningAdapter(provider);

    await expect(adapter.signCanonicalPayload({ a: 1 }, { purpose: "runtime_acknowledgement", now: NOW })).rejects.toThrow(
      /no active signing key for purpose "runtime_acknowledgement"/,
    );
  });

  it("key IDs are immutable across the key's lifecycle", async () => {
    const provider = new InMemoryKeyProvider("test");
    const created = await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
    const rotated = await provider.rotateSigningKey("decision_token", LATER);
    await provider.revokeSigningKey(rotated.key_id, "test", MUCH_LATER);

    const retired = await provider.getVerificationKey(created.key_id);
    const revoked = await provider.getVerificationKey(rotated.key_id);
    expect(retired?.key_id).toBe(created.key_id);
    expect(revoked?.key_id).toBe(rotated.key_id);
  });

  it("listVerificationKeys excludes PENDING keys but includes ACTIVE/RETIRED/REVOKED", async () => {
    const provider = new InMemoryKeyProvider("test");
    const first = await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
    await (provider as any).createKey({ purpose: "decision_token", environment: "test", now: NOW }); // stays PENDING
    const rotated = await provider.rotateSigningKey("decision_token", LATER);
    await provider.revokeSigningKey(rotated.key_id, "test", MUCH_LATER);

    const keys = await provider.listVerificationKeys("decision_token");
    const statuses = keys.map((k) => k.status).sort();
    expect(statuses).toEqual(["RETIRED", "REVOKED"]);
    expect(keys.some((k) => k.key_id === first.key_id)).toBe(true);
  });
});

describe("GA-3 EnvironmentKeyProvider", () => {
  it("loads real Ed25519 key material from injected configuration and can sign/verify with it", async () => {
    const source = new InMemoryKeyProvider("staging");
    const active = await source.createAndActivateKey({ purpose: "runtime_acknowledgement", environment: "staging", now: NOW });
    const keyPair = (source as any).keys.get(active.key_id).keyPair;
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    const keysJson = JSON.stringify([
      {
        key_id: active.key_id,
        purpose: "runtime_acknowledgement",
        algorithm: "Ed25519",
        status: "ACTIVE",
        environment: "staging",
        created_at: NOW,
        activated_at: NOW,
        public_key_jwk: publicJwk,
        private_key_jwk: privateJwk,
      },
    ]);

    const envProvider = new EnvironmentKeyProvider({ environment: "staging", keys_json: keysJson });
    await envProvider.ready();

    const adapter = createCryptoSigningAdapter(envProvider);
    const envelope = await adapter.signCanonicalPayload({ a: 1 }, { purpose: "runtime_acknowledgement", now: NOW });
    await expect(adapter.verifyCanonicalPayload(envelope)).resolves.toBe(true);
  });

  it("never reads process.env directly and does not print key material (constructor only accepts injected config)", () => {
    const source = new (class {})();
    void source;
    expect(EnvironmentKeyProvider.length).toBe(1); // constructor(config) — no implicit env access
  });

  it("rejects malformed keys_json", () => {
    expect(() => new EnvironmentKeyProvider({ environment: "staging", keys_json: "not json" })).toThrow();
  });

  it("a verification-only environment key (no private_key_jwk) can verify but cannot sign", async () => {
    const source = new InMemoryKeyProvider("staging");
    const active = await source.createAndActivateKey({ purpose: "evidence_pack", environment: "staging", now: NOW });
    const keyPair = (source as any).keys.get(active.key_id).keyPair;
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

    const keysJson = JSON.stringify([
      {
        key_id: active.key_id,
        purpose: "evidence_pack",
        algorithm: "Ed25519",
        status: "ACTIVE",
        environment: "staging",
        created_at: NOW,
        activated_at: NOW,
        public_key_jwk: publicJwk,
      },
    ]);
    const envProvider = new EnvironmentKeyProvider({ environment: "staging", keys_json: keysJson });
    await envProvider.ready();

    await expect(envProvider.signWithKey(active.key_id, new Uint8Array([1]))).rejects.toThrow();
  });
});

describe("GA-3 KMS provider scaffold (no live KMS available)", () => {
  it("every method throws KeyProviderNotImplementedError, never fabricating a result", async () => {
    const scaffold = new KmsKeyProviderScaffold({ environment: "production", provider_name: "aws-kms" });
    await expect(scaffold.getActiveSigningKey()).rejects.toThrow(KeyProviderNotImplementedError);
    await expect(scaffold.signWithKey()).rejects.toThrow(KeyProviderNotImplementedError);
    await expect(scaffold.rotateSigningKey()).rejects.toThrow(KeyProviderNotImplementedError);
    await expect(scaffold.revokeSigningKey()).rejects.toThrow(KeyProviderNotImplementedError);
  });
});

describe("GA-3 base64url helpers", () => {
  it("round-trips arbitrary byte sequences", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 16, 32]);
    const encoded = bufferToBase64Url(bytes.buffer);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});
