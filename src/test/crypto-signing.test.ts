import { describe, expect, it } from "vitest";

import {
  canonicalizePayload,
  canonicalPayloadHash,
  createCryptoSigningAdapter,
} from "@/lib/crypto-signing";
import { CanonicalizationError } from "@/lib/crypto-signing-types";
import { InMemoryKeyProvider } from "@/lib/key-management";

const NOW = "2026-07-11T12:00:00.000Z";

async function activeProvider() {
  const provider = new InMemoryKeyProvider("test");
  await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
  return provider;
}

describe("GA-3 canonical payload serialization", () => {
  it("produces the same canonical form regardless of key insertion order", () => {
    const a = canonicalizePayload({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = canonicalizePayload({ a: 2, c: { y: 2, z: 1 }, b: 1 });
    expect(a).toBe(b);
  });

  it("preserves array order (does not sort array elements)", () => {
    const canonical = canonicalizePayload({ items: [3, 1, 2] });
    expect(canonical).toBe('{"items":[3,1,2]}');
  });

  it("omits undefined object properties like JSON.stringify, but rejects undefined array entries", () => {
    expect(canonicalizePayload({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(() => canonicalizePayload({ arr: [1, undefined, 3] })).toThrow(CanonicalizationError);
  });

  it("rejects unsupported values: functions, symbols, bigint, NaN, Infinity, Date instances", () => {
    expect(() => canonicalizePayload({ f: () => 1 })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ s: Symbol("x") })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ n: 10n })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ n: NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ n: Infinity })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ d: new Date() })).toThrow(CanonicalizationError);
    expect(() => canonicalizePayload({ m: new Map() })).toThrow(CanonicalizationError);
  });

  it("computes a deterministic SHA-256 payload hash independent of key order", async () => {
    const hashA = await canonicalPayloadHash({ x: 1, y: 2 });
    const hashB = await canonicalPayloadHash({ y: 2, x: 1 });
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("GA-3 Ed25519 signing/verification (CryptoSigningAdapter)", () => {
  it("signs a canonical payload and verifies it successfully", async () => {
    const provider = await activeProvider();
    const adapter = createCryptoSigningAdapter(provider);

    const envelope = await adapter.signCanonicalPayload(
      { decision_id: "dec-1", schema_version: "v1" },
      { purpose: "decision_token", now: NOW },
    );

    expect(envelope.signature.algorithm).toBe("Ed25519");
    expect(envelope.signature.purpose).toBe("decision_token");
    expect(envelope.signature.signature.length).toBeGreaterThan(0);
    await expect(adapter.verifyCanonicalPayload(envelope)).resolves.toBe(true);
  });

  it("fails verification when the payload is modified after signing", async () => {
    const provider = await activeProvider();
    const adapter = createCryptoSigningAdapter(provider);
    const envelope = await adapter.signCanonicalPayload({ decision_id: "dec-1", schema_version: "v1" }, { purpose: "decision_token", now: NOW });

    const tampered = { ...envelope, payload: { ...envelope.payload, decision_id: "dec-2" } };
    await expect(adapter.verifyCanonicalPayload(tampered)).resolves.toBe(false);
  });

  it("fails verification when the signature bytes are modified", async () => {
    const provider = await activeProvider();
    const adapter = createCryptoSigningAdapter(provider);
    const envelope = await adapter.signCanonicalPayload({ decision_id: "dec-1", schema_version: "v1" }, { purpose: "decision_token", now: NOW });

    const flipped = envelope.signature.signature.slice(0, -4) + (envelope.signature.signature.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    const tampered = { ...envelope, signature: { ...envelope.signature, signature: flipped } };
    await expect(adapter.verifyCanonicalPayload(tampered)).resolves.toBe(false);
  });

  it("fails verification against the wrong public key", async () => {
    const providerA = await activeProvider();
    const providerB = new InMemoryKeyProvider("test");
    await providerB.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });

    const adapterA = createCryptoSigningAdapter(providerA);
    const adapterB = createCryptoSigningAdapter(providerB);
    const envelope = await adapterA.signCanonicalPayload({ decision_id: "dec-1", schema_version: "v1" }, { purpose: "decision_token", now: NOW });

    // adapterB's provider has never heard of adapterA's key_id.
    await expect(adapterB.verifyCanonicalPayload(envelope)).resolves.toBe(false);
  });

  it("produces identical signatures for the same canonical payload signed twice with the same key", async () => {
    const provider = await activeProvider();
    const adapter = createCryptoSigningAdapter(provider);
    const payload = { decision_id: "dec-1", schema_version: "v1" };

    const first = await adapter.signCanonicalPayload(payload, { purpose: "decision_token", now: NOW });
    const second = await adapter.signCanonicalPayload({ schema_version: "v1", decision_id: "dec-1" }, { purpose: "decision_token", now: NOW });

    expect(first.signature.signature).toBe(second.signature.signature);
    await expect(adapter.verifyCanonicalPayload(second)).resolves.toBe(true);
  });

  it("refuses to sign when there is no active key for the requested purpose", async () => {
    const provider = new InMemoryKeyProvider("test");
    const adapter = createCryptoSigningAdapter(provider);
    await expect(adapter.signCanonicalPayload({ a: 1 }, { purpose: "evidence_pack", now: NOW })).rejects.toThrow();
  });
});
