import { describe, expect, it } from "vitest";

import type { DecisionRecord } from "@/lib/agent-gateway";
import { InMemoryKeyProvider } from "@/lib/key-management";
import { createVerificationService } from "@/lib/signature-verification";
import {
  runSupplierRiskRuntimePipeline,
  type SupplierRiskDecisionLedgerRow,
  type SupplierRiskPipelineInput,
  type SupplierRiskRuntimeDeps,
} from "@/lib/supplier-risk-runtime-pipeline";

/**
 * GA-3 — Proves the GA-1 Supplier Risk production path emits real, verifiable
 * Ed25519-signed artifacts (decision token + runtime acknowledgement) and
 * that no mock/non-cryptographic signature values remain on that path.
 */

const NOW = "2026-07-11T12:00:00.000Z";

function buildDeps(keyProvider: InMemoryKeyProvider): {
  deps: SupplierRiskRuntimeDeps;
  ledgerRows: SupplierRiskDecisionLedgerRow[];
} {
  const ledgerRows: SupplierRiskDecisionLedgerRow[] = [];
  const deps: SupplierRiskRuntimeDeps = {
    keyProvider,
    persistDecisionRecord: async (record: DecisionRecord) => ({ decision_id: record.decision_id }),
    writeAuditEvent: async () => ({ audit_id: "audit-1" }),
    persistDecisionLedgerRow: async (row: SupplierRiskDecisionLedgerRow) => {
      ledgerRows.push(row);
      return { decision_id: `decision-ledger-${ledgerRows.length}` };
    },
  };
  return { deps, ledgerRows };
}

function pipelineInput(overrides: Partial<SupplierRiskPipelineInput> = {}): SupplierRiskPipelineInput {
  return {
    signal: {
      event_id: "evt-supplier-ga3-001",
      source_system: "supplier-portal",
      connector_id: "connector-supplier-portal",
      source_record_id: "src-supplier-ga3-001",
      tenant_id: "org-acme",
      organization_id: "org-acme",
      supplier_id: "supplier-critical-1",
      delivery_delay_hours: 48,
      impact_amount: 750_000,
      description: "Critical supplier delivery risk detected via supplier portal feed.",
      observed_at: NOW,
    },
    now: NOW,
    ...overrides,
  };
}

describe("GA-3 Supplier Risk production-path signing integration", () => {
  it("emits a real Ed25519-signed decision token and runtime acknowledgement — no mock signatures", async () => {
    const keyProvider = new InMemoryKeyProvider("supplier-risk-ga3-test");
    const { deps } = buildDeps(keyProvider);

    const result = await runSupplierRiskRuntimePipeline(pipelineInput(), deps);

    expect(result.status).toBe("DECISION_LEDGER_READY");
    expect(result.agent_gateway_result?.decision_token).not.toBeNull();
    const token = result.agent_gateway_result!.decision_token!.token;
    expect(token).not.toMatch(/mock-decision-token/);

    const envelope = JSON.parse(token);
    expect(envelope.signature.algorithm).toBe("Ed25519");
    expect(envelope.signature.purpose).toBe("decision_token");

    const ack = result.runtime_service_response?.ok ? result.runtime_service_response.acknowledgement : null;
    expect(ack).not.toBeNull();
    expect(ack!.algorithm).toBe("Ed25519");
    expect(ack!.signing_purpose).toBe("runtime_acknowledgement");
    expect(ack!.signature).not.toMatch(/^mock-signature-/);

    const verificationService = createVerificationService({ keyProvider, now: () => NOW });
    const tokenVerification = await verificationService.verifyDecisionToken(envelope, {
      expected_tenant_id: "org-acme",
      expected_organization_id: "org-acme",
    });
    expect(tokenVerification.valid).toBe(true);
  });

  it("fails verification when the signed decision token's payload is tampered with", async () => {
    const keyProvider = new InMemoryKeyProvider("supplier-risk-ga3-test-tamper");
    const { deps } = buildDeps(keyProvider);
    const result = await runSupplierRiskRuntimePipeline(pipelineInput(), deps);
    const envelope = JSON.parse(result.agent_gateway_result!.decision_token!.token);

    const tampered = { ...envelope, payload: { ...envelope.payload, decision_record_hash: "forged-hash" } };
    const verificationService = createVerificationService({ keyProvider, now: () => NOW });
    const verification = await verificationService.verifyDecisionToken(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.invalid_reason).toBe("PAYLOAD_TAMPERED");
  });

  it("rejects a decision token verified against the wrong tenant", async () => {
    const keyProvider = new InMemoryKeyProvider("supplier-risk-ga3-test-tenant");
    const { deps } = buildDeps(keyProvider);
    const result = await runSupplierRiskRuntimePipeline(pipelineInput(), deps);
    const envelope = JSON.parse(result.agent_gateway_result!.decision_token!.token);

    const verificationService = createVerificationService({ keyProvider, now: () => NOW });
    const verification = await verificationService.verifyDecisionToken(envelope, {
      expected_tenant_id: "org-other-tenant",
    });
    expect(verification.valid).toBe(false);
    expect(verification.invalid_reason).toBe("TENANT_MISMATCH");
  });

  it("reuses an explicitly injected keyProvider across the whole run (decision token and ack share the same key material)", async () => {
    const keyProvider = new InMemoryKeyProvider("supplier-risk-ga3-shared");
    const { deps } = buildDeps(keyProvider);
    const result = await runSupplierRiskRuntimePipeline(pipelineInput(), deps);

    const tokenEnvelope = JSON.parse(result.agent_gateway_result!.decision_token!.token);
    const decisionKey = await keyProvider.getVerificationKey(tokenEnvelope.signature.key_id);
    expect(decisionKey).not.toBeNull();
    expect(decisionKey!.purpose).toBe("decision_token");

    const ack = result.runtime_service_response?.ok ? result.runtime_service_response.acknowledgement : null;
    const ackKey = await keyProvider.getVerificationKey(ack!.signature_key_id);
    expect(ackKey).not.toBeNull();
    expect(ackKey!.purpose).toBe("runtime_acknowledgement");
  });

  it("still bootstraps its own signing keys and produces real signatures when no keyProvider is injected", async () => {
    const ledgerRows: SupplierRiskDecisionLedgerRow[] = [];
    const deps: SupplierRiskRuntimeDeps = {
      persistDecisionRecord: async (record: DecisionRecord) => ({ decision_id: record.decision_id }),
      writeAuditEvent: async () => ({ audit_id: "audit-1" }),
      persistDecisionLedgerRow: async (row: SupplierRiskDecisionLedgerRow) => {
        ledgerRows.push(row);
        return { decision_id: `decision-ledger-${ledgerRows.length}` };
      },
    };

    const result = await runSupplierRiskRuntimePipeline(pipelineInput(), deps);
    expect(result.status).toBe("DECISION_LEDGER_READY");
    const token = result.agent_gateway_result!.decision_token!.token;
    expect(token).not.toMatch(/mock-decision-token/);
    const envelope = JSON.parse(token);
    expect(envelope.signature.algorithm).toBe("Ed25519");
  });
});
