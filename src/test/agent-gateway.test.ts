import { describe, expect, it, vi } from "vitest";

import {
  AGENT_GATEWAY_SCHEMA_VERSION,
  classifyAgentDecision,
  processAgentGatewayRequest,
  validateAgentGatewayRequest,
  type AgentGatewayDependencies,
  type AgentGatewayRequest,
} from "@/lib/agent-gateway";

const baseRequest: AgentGatewayRequest = {
  agent_id: "agent-aicis-prod",
  tenant_id: "tenant-acme",
  organization_id: "org-acme",
  decision_type: "pricing_action",
  requested_action: "Reduce discount leakage on strategic accounts",
  evidence_references: ["ev-price-001", "ev-policy-001"],
  confidence: 82,
  business_impact: {
    amount: 250000,
    currency: "EUR",
    description: "Estimated annual margin recovery",
  },
  risk_level: "medium",
  justification: "Pricing variance crossed policy threshold with verified evidence.",
  metadata: {
    model: {
      provider: "model-agnostic",
      name: "external-agent",
      version: "2026-07",
    },
    source: "unit-test",
  },
};

function deps(overrides: Partial<AgentGatewayDependencies> = {}): AgentGatewayDependencies {
  return {
    validateTenant: vi.fn(async ({ tenant_id }) => ({ valid: tenant_id === "tenant-acme" })),
    validateOrganization: vi.fn(async ({ tenant_id, organization_id }) => ({
      valid: tenant_id === "tenant-acme" && organization_id === "org-acme",
    })),
    assembleEvidence: vi.fn(async (references) =>
      references.map((id) => ({
        id,
        uri: `quantivis://evidence/${id}`,
        hash: `hash-${id}`,
        integrity: "verified" as const,
        summary: `Evidence ${id}`,
        source: "decision_ledger.evidence_sources",
      })),
    ),
    evaluatePolicy: vi.fn(async ({ decision_class }) => ({
      allowed: true,
      policy_id: "policy-enterprise-default",
      reasons: [],
      required_approvers:
        decision_class === "Class A"
          ? ["executive_sponsor", "risk_owner", "compliance_owner"]
          : decision_class === "Class B"
            ? ["business_owner"]
            : [],
    })),
    persistDecisionRecord: vi.fn(async (record) => ({ decision_id: record.decision_id })),
    writeAuditEvent: vi.fn(async () => ({ audit_id: "audit-agent-gateway-1" })),
    signDecisionToken: vi.fn(async (payload) => `signed.${payload.decision_id}.${payload.approval_state}`),
    now: () => "2026-07-03T12:00:00.000Z",
    generateId: (prefix) => `${prefix}_test_001`,
    ...overrides,
  };
}

describe("Agent Gateway", () => {
  it("validates the model-agnostic agent request schema", () => {
    const result = validateAgentGatewayRequest(baseRequest);
    expect(result.success).toBe(true);

    const invalid = validateAgentGatewayRequest({
      ...baseRequest,
      confidence: 150,
    });
    expect(invalid.success).toBe(false);
    expect(invalid.errors.join(" ")).toContain("confidence");
  });

  it("classifies decisions as Class C, B, or A from risk and business impact", () => {
    expect(classifyAgentDecision({ risk_level: "low", amount: 1000 })).toBe("Class C");
    expect(classifyAgentDecision({ risk_level: "medium", amount: 50000 })).toBe("Class B");
    expect(classifyAgentDecision({ risk_level: "critical", amount: 1 })).toBe("Class A");
    expect(classifyAgentDecision({ risk_level: "medium", amount: 1_000_000 })).toBe("Class A");
  });

  it("approves Class C requests when tenant, organization, evidence, and policy pass", async () => {
    const request = {
      ...baseRequest,
      risk_level: "low" as const,
      business_impact: { ...baseRequest.business_impact, amount: 5000 },
    };
    const result = await processAgentGatewayRequest(request, deps());

    expect(result.status).toBe("APPROVED");
    expect(result.decision_record.decision_version).toBe(AGENT_GATEWAY_SCHEMA_VERSION);
    expect(result.decision_record.decision_class).toBe("Class C");
    expect(result.decision_record.status).toBe("APPROVED");
    expect(result.decision_token.approval_state).toBe("APPROVED");
    expect(result.decision_token.token).toContain("signed.");
    expect(result.decision_record.evidence.every((e) => e.integrity === "verified")).toBe(true);
  });

  it("routes Class B requests to required approval instead of direct execution", async () => {
    const result = await processAgentGatewayRequest(baseRequest, deps());

    expect(result.status).toBe("REQUIRES_APPROVAL");
    expect(result.decision_record.decision_class).toBe("Class B");
    expect(result.decision_record.approvals.required_approvers).toEqual(["business_owner"]);
    expect(result.decision_token.required_approvers).toEqual(["business_owner"]);
  });

  it("persists the decision record with the immutable audit event reference attached", async () => {
    const persistedSnapshots: unknown[] = [];
    const persistDecisionRecord = vi.fn(async (record) => {
      persistedSnapshots.push(JSON.parse(JSON.stringify(record)));
      return { decision_id: record.decision_id };
    });
    const result = await processAgentGatewayRequest(baseRequest, deps({ persistDecisionRecord }));

    expect(result.status).toBe("REQUIRES_APPROVAL");
    expect(result.decision_record?.audit.audit_event_id).toBe("audit-agent-gateway-1");
    expect(persistedSnapshots[0]).toMatchObject({
      audit: {
        audit_event_id: "audit-agent-gateway-1",
      },
    });
  });

  it("generates a challenge record for Class A decisions", async () => {
    const result = await processAgentGatewayRequest(
      {
        ...baseRequest,
        risk_level: "critical",
        business_impact: { ...baseRequest.business_impact, amount: 2_000_000 },
      },
      deps(),
    );

    expect(result.status).toBe("REQUIRES_APPROVAL");
    expect(result.decision_record.decision_class).toBe("Class A");
    expect(result.decision_record.challenge).toMatchObject({
      strongest_argument_against: expect.any(String),
      missing_evidence: expect.any(Array),
      contradictory_evidence: expect.any(Array),
      regulatory_concerns: expect.any(Array),
    });
    expect(result.decision_record.approvals.required_approvers).toEqual([
      "executive_sponsor",
      "risk_owner",
      "compliance_owner",
    ]);
  });

  it("rejects cross-tenant or invalid organization requests before storing a decision", async () => {
    const persistDecisionRecord = vi.fn();
    const writeAuditEvent = vi.fn(async () => ({ audit_id: "audit-reject" }));
    const result = await processAgentGatewayRequest(
      { ...baseRequest, organization_id: "org-other" },
      deps({ persistDecisionRecord, writeAuditEvent }),
    );

    expect(result.status).toBe("REJECTED");
    expect(result.decision_record).toBeNull();
    expect(persistDecisionRecord).not.toHaveBeenCalled();
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "agent_gateway.rejected",
        organization_id: "org-other",
      }),
    );
  });

  it("rejects requests with unverified evidence and writes an immutable audit event", async () => {
    const writeAuditEvent = vi.fn(async () => ({ audit_id: "audit-evidence-reject" }));
    const result = await processAgentGatewayRequest(
      baseRequest,
      deps({
        assembleEvidence: vi.fn(async () => [
          {
            id: "ev-bad",
            uri: "quantivis://evidence/ev-bad",
            hash: "hash-ev-bad",
            integrity: "failed",
            summary: "Tampered evidence",
            source: "decision_ledger.evidence_sources",
          },
        ]),
        writeAuditEvent,
      }),
    );

    expect(result.status).toBe("REJECTED");
    expect(result.failures).toContain("evidence_integrity_failed");
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "agent_gateway.rejected",
        payload: expect.objectContaining({ failures: ["evidence_integrity_failed"] }),
      }),
    );
  });

  it("rejects policy-denied actions and still audits the request", async () => {
    const result = await processAgentGatewayRequest(
      baseRequest,
      deps({
        evaluatePolicy: vi.fn(async () => ({
          allowed: false,
          policy_id: "policy-deny-high-risk",
          reasons: ["policy_denied"],
          required_approvers: [],
        })),
      }),
    );

    expect(result.status).toBe("REJECTED");
    expect(result.failures).toContain("policy_denied");
    expect(result.decision_record).toBeNull();
  });

  it("attaches certification references to the decision record", async () => {
    const result = await processAgentGatewayRequest(
      baseRequest,
      deps({
        getCertificationReference: vi.fn(async () => ({
          framework: "quantivis-enterprise-certification",
          gate: "Decision Pipeline",
          pipeline: "decision-lifecycle",
          deployment_verification: "deployment-verification",
        })),
      }),
    );

    expect(result.decision_record?.certification_reference).toEqual({
      framework: "quantivis-enterprise-certification",
      gate: "Decision Pipeline",
      pipeline: "decision-lifecycle",
      deployment_verification: "deployment-verification",
    });
  });
});
