import { describe, expect, it } from "vitest";

import { AGENT_GATEWAY_VERSION, type AgentGatewayRequest } from "@/lib/agent-gateway";
import { InMemoryKeyProvider } from "@/lib/key-management";
import {
  createRuntimeGateway,
  Ed25519RuntimeSigningAdapter,
  InMemoryRuntimePersistenceAdapter,
  InMemoryRuntimeQueueAdapter,
  MockRuntimeEventEmitterAdapter,
} from "@/lib/runtime-gateway";
import { createVerificationService } from "@/lib/signature-verification";

const NOW = "2026-07-11T12:00:00.000Z";

function validRequest(): AgentGatewayRequest {
  return {
    agent_id: "supplier-risk-runtime-agent",
    tenant_id: "org-acme",
    organization_id: "org-acme",
    idempotency_key: "idem-1",
    decision_type: "supplier_risk_mitigation",
    requested_action: "Review supplier mitigation options",
    evidence_references: ["evf:fact-1"],
    confidence: 96,
    business_impact: { amount: 750_000, description: "impact" },
    risk_level: "high",
    justification: "justification",
    metadata: {},
  };
}

async function realSigningAdapter() {
  const provider = new InMemoryKeyProvider("test");
  await provider.createAndActivateKey({ purpose: "runtime_acknowledgement", environment: "test", now: NOW });
  const key = await provider.getActiveSigningKey("runtime_acknowledgement");
  return { provider, signing: new Ed25519RuntimeSigningAdapter(provider, key!.key_id) };
}

function gatewayFixture(signing: Ed25519RuntimeSigningAdapter) {
  const queue = new InMemoryRuntimeQueueAdapter();
  const persistence = new InMemoryRuntimePersistenceAdapter();
  const events = new MockRuntimeEventEmitterAdapter();
  const gateway = createRuntimeGateway({
    queue,
    persistence,
    signing,
    events,
    now: () => NOW,
    validateTenant: async () => ({ valid: true }),
    validateOrganization: async () => ({ valid: true }),
  });
  return { gateway, queue, persistence, events };
}

describe("GA-3 Runtime Gateway integration — real Ed25519 acknowledgement signing", () => {
  it("signs a real acknowledgement and it verifies as trusted", async () => {
    const { signing, provider } = await realSigningAdapter();
    const { gateway } = gatewayFixture(signing);

    const result = await gateway.submitGatewayRequest(validRequest());

    expect(result.status).toBe("ACKNOWLEDGED");
    expect(result.acknowledgement?.algorithm).toBe("Ed25519");
    expect(result.acknowledgement?.signing_purpose).toBe("runtime_acknowledgement");
    expect(result.acknowledgement?.gateway_version).toBe(AGENT_GATEWAY_VERSION);
    expect(result.acknowledgement?.signature).not.toMatch(/^mock-signature-/);
    expect(result.signature_verified).toBe(true);

    const verificationService = createVerificationService({ keyProvider: provider, now: () => NOW });
    const envelope = {
      payload: { ...result.acknowledgement!, signature: undefined },
      signature: {
        schema_version: "quantivis.crypto-signing.v1" as const,
        key_id: result.acknowledgement!.signature_key_id,
        algorithm: "Ed25519" as const,
        purpose: "runtime_acknowledgement" as const,
        issued_at: result.acknowledgement!.received_at,
        signature: result.acknowledgement!.signature,
      },
    };
    delete (envelope.payload as any).signature;
    const verification = await verificationService.verifyRuntimeAcknowledgement(envelope);
    expect(verification.valid).toBe(true);
  });

  it("does not treat the acknowledgement as trusted before verification passes — a modified request_hash fails signature_verified", async () => {
    const { signing } = await realSigningAdapter();
    const { gateway } = gatewayFixture(signing);
    const result = await gateway.submitGatewayRequest(validRequest());
    expect(result.acknowledgement).not.toBeNull();

    const tampered = { ...result.acknowledgement!, request_hash: "fnv1a-forged00" };
    const stillValid = await signing.verifyAcknowledgement(tampered);
    expect(stillValid).toBe(false);
  });

  it("rejects verification against the wrong purpose", async () => {
    const { signing } = await realSigningAdapter();
    const { gateway } = gatewayFixture(signing);
    const result = await gateway.submitGatewayRequest(validRequest());

    const relabeled = { ...result.acknowledgement!, signing_purpose: "evidence_pack" as any };
    // signAcknowledgement/verifyAcknowledgement round-trip through the same
    // canonicalized object, so changing signing_purpose after the fact is
    // itself a payload modification and must fail verification.
    const stillValid = await signing.verifyAcknowledgement(relabeled);
    expect(stillValid).toBe(false);
  });
});
