import { describe, expect, it } from "vitest";

import {
  attachEvidencePackSignature,
  buildEvidencePack,
  evidencePackToHtml,
  evidencePackToJSON,
  signEvidencePackManifest,
} from "@/lib/evidence-pack";
import type { EvidencePackDecisionInput } from "@/lib/evidence-pack-types";
import { InMemoryKeyProvider } from "@/lib/key-management";
import { createVerificationService } from "@/lib/signature-verification";
import { DEMO_DECISION } from "@/components/decisions/executive-review-flow";

const FIXED_NOW = () => "2026-07-09T12:00:00.000Z";

function baseDecision(overrides: Partial<EvidencePackDecisionInput> = {}): EvidencePackDecisionInput {
  return {
    ...DEMO_DECISION,
    id: "decision-ga3-001",
    organization_id: "org-1",
    ...overrides,
  } as EvidencePackDecisionInput;
}

describe("GA-3 Evidence Pack signed-manifest integration", () => {
  it("stays unsigned ('SIGNING NOT AVAILABLE') when buildEvidencePack is called without a signing step", () => {
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });
    expect(pack.sections.digital_signature.status).toBe("unavailable");
    expect(pack.sections.digital_signature.summary).toContain("SIGNING NOT AVAILABLE");
    expect(pack.sections.digital_signature.data.signature).toBeNull();
  });

  it("produces a real Ed25519-signed manifest that verifies, and never a mock signature", async () => {
    const keyProvider = new InMemoryKeyProvider("evidence-pack-ga3-test");
    await keyProvider.createAndActivateKey({ purpose: "evidence_pack", environment: "evidence-pack-ga3-test", now: FIXED_NOW() });
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });

    const envelope = await signEvidencePackManifest(pack, keyProvider, FIXED_NOW());
    expect(envelope.signature.algorithm).toBe("Ed25519");
    expect(envelope.signature.purpose).toBe("evidence_pack");
    expect(envelope.signature.signature).not.toMatch(/^mock-/);
    expect(envelope.payload.evidence_pack_hash).toBe(pack.evidence_pack_hash);

    const signedPack = attachEvidencePackSignature(pack, envelope);
    expect(signedPack.sections.digital_signature.status).toBe("complete");
    expect(signedPack.sections.digital_signature.data.signature).toBe(envelope.signature.signature);
    // The rest of the pack is untouched — signing only replaces digital_signature.
    expect(signedPack.evidence_pack_hash).toBe(pack.evidence_pack_hash);
    expect(signedPack.sections.decision_summary).toEqual(pack.sections.decision_summary);

    const verificationService = createVerificationService({ keyProvider, now: FIXED_NOW });
    const verification = await verificationService.verifyEvidencePackManifest(envelope);
    expect(verification.valid).toBe(true);
  });

  it("fails verification when the evidence_pack_hash in the signed manifest is tampered with", async () => {
    const keyProvider = new InMemoryKeyProvider("evidence-pack-ga3-tamper");
    await keyProvider.createAndActivateKey({ purpose: "evidence_pack", environment: "evidence-pack-ga3-tamper", now: FIXED_NOW() });
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });
    const envelope = await signEvidencePackManifest(pack, keyProvider, FIXED_NOW());

    const tampered = { ...envelope, payload: { ...envelope.payload, evidence_pack_hash: "forged-hash" } };
    const verificationService = createVerificationService({ keyProvider, now: FIXED_NOW });
    const verification = await verificationService.verifyEvidencePackManifest(tampered);
    expect(verification.valid).toBe(false);
    expect(verification.invalid_reason).toBe("PAYLOAD_TAMPERED");
  });

  it("throws (never falls back to a mock signature) when no active evidence_pack key exists", async () => {
    const keyProvider = new InMemoryKeyProvider("evidence-pack-ga3-no-key");
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });
    await expect(signEvidencePackManifest(pack, keyProvider, FIXED_NOW())).rejects.toThrow();
  });

  it("JSON export includes the signed manifest; HTML export shows verification metadata but no private key data", async () => {
    const keyProvider = new InMemoryKeyProvider("evidence-pack-ga3-export");
    await keyProvider.createAndActivateKey({ purpose: "evidence_pack", environment: "evidence-pack-ga3-export", now: FIXED_NOW() });
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });
    const envelope = await signEvidencePackManifest(pack, keyProvider, FIXED_NOW());
    const signedPack = attachEvidencePackSignature(pack, envelope);

    const json = evidencePackToJSON(signedPack);
    expect(json).toContain(envelope.signature.signature);
    expect(json).toContain(envelope.signature.key_id);

    const html = evidencePackToHtml(signedPack);
    expect(html).toContain("Digital Signature");
    expect(html).toContain(envelope.signature.key_id);
    expect(html).toContain(envelope.signature.algorithm);
    // The HTML renders only section summaries, never raw signature bytes or key material.
    expect(html).not.toContain(envelope.signature.signature);
  });

  it("re-applying attachEvidencePackSignature with null restores the honest unsigned state", async () => {
    const keyProvider = new InMemoryKeyProvider("evidence-pack-ga3-revert");
    await keyProvider.createAndActivateKey({ purpose: "evidence_pack", environment: "evidence-pack-ga3-revert", now: FIXED_NOW() });
    const pack = buildEvidencePack(baseDecision(), { now: FIXED_NOW });
    const envelope = await signEvidencePackManifest(pack, keyProvider, FIXED_NOW());
    const signedPack = attachEvidencePackSignature(pack, envelope);
    expect(signedPack.sections.digital_signature.status).toBe("complete");

    const revertedPack = attachEvidencePackSignature(signedPack, null);
    expect(revertedPack.sections.digital_signature.status).toBe("unavailable");
    expect(revertedPack.sections.digital_signature.summary).toContain("SIGNING NOT AVAILABLE");
  });
});
