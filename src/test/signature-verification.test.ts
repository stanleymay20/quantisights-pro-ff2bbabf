import { describe, expect, it } from "vitest";

import { createCryptoSigningAdapter } from "@/lib/crypto-signing";
import { InMemoryKeyProvider } from "@/lib/key-management";
import { createVerificationService } from "@/lib/signature-verification";

const NOW = "2026-07-11T12:00:00.000Z";
const LATER = "2026-07-11T13:00:00.000Z";
const AFTER_EXPIRY = "2026-07-12T12:00:00.000Z";

function decisionTokenPayload(overrides: Record<string, unknown> = {}) {
  return {
    token_schema_version: "quantivis.decision-token.v1",
    decision_id: "decision_abc",
    decision_record_hash: "fnv1a-deadbeef",
    tenant_id: "org-acme",
    organization_id: "org-acme",
    policy_id: "supplier-risk-runtime-policy",
    policy_version: "v1",
    approval_state: "REQUIRES_APPROVAL",
    issued_at: NOW,
    expiry: LATER,
    required_approvers: ["Operations Lead"],
    ...overrides,
  };
}

function acknowledgementPayload(overrides: Record<string, unknown> = {}) {
  return {
    acknowledgement_id: "qv-ack-1",
    correlation_id: "qv-corr-1",
    request_hash: "fnv1a-cafef00d",
    tenant_id: "org-acme",
    organization_id: "org-acme",
    gateway_version: "ag-2.0.0",
    runtime_version: "ag-3a.1",
    schema_version: "quantivis.gateway-acknowledgement.v1",
    status: "ACKNOWLEDGED",
    received_at: NOW,
    ...overrides,
  };
}

async function providerWithActiveKeys() {
  const provider = new InMemoryKeyProvider("test");
  await provider.createAndActivateKey({ purpose: "decision_token", environment: "test", now: NOW });
  await provider.createAndActivateKey({ purpose: "runtime_acknowledgement", environment: "test", now: NOW });
  await provider.createAndActivateKey({ purpose: "evidence_pack", environment: "test", now: NOW });
  return provider;
}

describe("GA-3 signature verification service — decision tokens", () => {
  it("verifies a validly signed decision token", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const result = await service.verifyDecisionToken(envelope);

    expect(result.valid).toBe(true);
    expect(result.invalid_reason).toBeNull();
    expect(result.purpose).toBe("decision_token");
    expect(result.algorithm).toBe("Ed25519");
  });

  it("rejects an expired decision token", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => AFTER_EXPIRY });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload({ expiry: LATER }), { purpose: "decision_token", now: NOW });
    const result = await service.verifyDecisionToken(envelope);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("ARTIFACT_EXPIRED");
  });

  it("rejects a token whose decision_record_hash was modified after signing", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const tampered = { ...envelope, payload: { ...envelope.payload, decision_record_hash: "fnv1a-forged00" } };
    const result = await service.verifyDecisionToken(tampered);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("PAYLOAD_TAMPERED");
  });

  it("rejects a decision token issued for a different tenant", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload({ tenant_id: "org-globex" }), { purpose: "decision_token", now: NOW });
    const result = await service.verifyDecisionToken(envelope, { expected_tenant_id: "org-acme" });

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("TENANT_MISMATCH");
  });

  it("rejects a decision token issued for a different organization", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload({ organization_id: "org-globex" }), { purpose: "decision_token", now: NOW });
    const result = await service.verifyDecisionToken(envelope, { expected_tenant_id: "org-acme", expected_organization_id: "org-acme" });

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("ORGANIZATION_MISMATCH");
  });

  it("rejects a token whose policy_id/policy_version was modified after signing", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const tampered = { ...envelope, payload: { ...envelope.payload, policy_version: "v2" } };
    const result = await service.verifyDecisionToken(tampered);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("PAYLOAD_TAMPERED");
  });

  it("rejects a token whose key was revoked", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const key = await provider.getActiveSigningKey("decision_token");
    await provider.revokeSigningKey(key!.key_id, "compromised", LATER);

    const service = createVerificationService({ keyProvider: provider, now: () => AFTER_EXPIRY });
    const result = await service.verifyDecisionToken(envelope);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("KEY_REVOKED");
  });

  it("rejects an artifact signed by an unknown key", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });

    const emptyProvider = new InMemoryKeyProvider("other");
    const service = createVerificationService({ keyProvider: emptyProvider, now: () => NOW });
    const result = await service.verifyDecisionToken(envelope);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("KEY_NOT_FOUND");
  });

  it("rejects a malformed/oversized verification request without throwing", async () => {
    const provider = await providerWithActiveKeys();
    const service = createVerificationService({ keyProvider: provider, now: () => NOW, max_artifact_bytes: 100 });

    const malformed = await service.verifyDecisionToken({ not: "a signed envelope" });
    expect(malformed.valid).toBe(false);
    expect(malformed.invalid_reason).toBe("MALFORMED_ARTIFACT");

    const oversized = await service.verifyDecisionToken({ payload: decisionTokenPayload({ padding: "x".repeat(1000) }), signature: { fake: true } });
    expect(oversized.valid).toBe(false);
    expect(oversized.invalid_reason).toBe("MALFORMED_ARTIFACT");
  });
});

describe("GA-3 signature verification service — runtime acknowledgements", () => {
  it("verifies a validly signed runtime acknowledgement", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(acknowledgementPayload(), { purpose: "runtime_acknowledgement", now: NOW });
    const result = await service.verifyRuntimeAcknowledgement(envelope);

    expect(result.valid).toBe(true);
  });

  it("rejects an acknowledgement whose request_hash was modified", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(acknowledgementPayload(), { purpose: "runtime_acknowledgement", now: NOW });
    const tampered = { ...envelope, payload: { ...envelope.payload, request_hash: "fnv1a-forged00" } };
    const result = await service.verifyRuntimeAcknowledgement(tampered);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("PAYLOAD_TAMPERED");
  });

  it("rejects a decision token verified against the acknowledgement purpose (wrong purpose)", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const decisionEnvelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const result = await service.verifyRuntimeAcknowledgement(decisionEnvelope as any);

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("MALFORMED_ARTIFACT");
  });

  it("rejects when the signature block itself claims the wrong purpose for the requested verification", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(acknowledgementPayload(), { purpose: "runtime_acknowledgement", now: NOW });
    const relabeled = { ...envelope, signature: { ...envelope.signature, purpose: "evidence_pack" as const } };
    const result = await service.verifySignedEnvelope(relabeled, { expected_purpose: "runtime_acknowledgement" });

    expect(result.valid).toBe(false);
    expect(result.invalid_reason).toBe("PURPOSE_MISMATCH");
  });
});

describe("GA-3 signature verification — security", () => {
  it("never includes private key material in a signed envelope or a verification result", async () => {
    const provider = await providerWithActiveKeys();
    const adapter = createCryptoSigningAdapter(provider);
    const service = createVerificationService({ keyProvider: provider, now: () => NOW });

    const envelope = await adapter.signCanonicalPayload(decisionTokenPayload(), { purpose: "decision_token", now: NOW });
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toMatch(/private/i);
    expect(serialized).not.toMatch(/"d":/); // JWK private scalar field name

    const result = await service.verifyDecisionToken(envelope);
    expect(JSON.stringify(result)).not.toMatch(/private/i);
  });
});
