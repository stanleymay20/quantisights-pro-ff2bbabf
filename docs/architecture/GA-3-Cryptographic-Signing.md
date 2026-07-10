# GA-3 — Enterprise Cryptographic Signing, Verification, and Key Rotation

## Purpose

GA-3 replaces every mock/non-cryptographic signature in the production Supplier Risk path with real asymmetric signing, adds a framework-agnostic signature-verification service, and introduces a key-lifecycle model (creation, rotation, revocation, expiry) behind a dependency-injected `KeyProvider` boundary. It does not modify RTS-1, signal-quality logic, contradiction detection, Verified Fact Promotion, Decision Candidate Generation, the Runtime Queue/Persistence contracts, idempotency behavior, Executive Brief, Decision Review, Outcome, Scenario Templates, or Authentication/Authorization — Agent Gateway and Runtime Gateway are touched only to replace mock signing with the real adapter.

## Algorithm choice and rationale

**Ed25519**, via the platform-native WebCrypto API (`globalThis.crypto.subtle`). No fallback to ECDSA P-256 was needed — Ed25519 keygen/sign/verify/JWK export-import were verified working directly (empirically, not just from documentation) in this repository's Node 22.22.2 runtime, and Deno's `crypto.subtle` implements the same standard WebCrypto surface, so the identical code path runs in both the app/test runtime and Supabase edge functions.

Rationale: Ed25519 is deterministic (no per-signature randomness requirement that can silently degrade to insecure if a caller's RNG is weak — the algorithm's internal nonce derivation is part of the standard), has small fixed-size keys and signatures, needs no parameter/curve configuration, and is a WebCrypto first-class algorithm with `sign`/`verify` primitives — no custom crypto, no third-party crypto library dependency was added. HMAC was rejected as a primary signing model per the task's explicit constraint (symmetric — anyone who can verify can forge) and RSA was rejected as unnecessary complexity/key size without any justifying constraint. No mock signature or plain hash (e.g. FNV-1a) is ever presented as a cryptographic signature anywhere in the GA-3 code path.

## Files

**New library code**
- `src/lib/crypto-signing-types.ts` — schema version, algorithm/purpose enums, `JsonValue`, `SignatureBlock`, `SignedEnvelope<T>`, zod schemas.
- `src/lib/crypto-signing.ts` — canonical JSON serialization, SHA-256 payload hashing, `createCryptoSigningAdapter(keyProvider)` (the sole `CryptoSigningAdapter` implementation).
- `src/lib/key-management-types.ts` — `KeyStatus`, `SigningKeyMetadata`, `CreateSigningKeyInput`, `KeyLifecycleAuditEvent`, the `KeyProvider` contract, `KeyProviderError`/`KeyProviderNotImplementedError`.
- `src/lib/key-management.ts` — `InMemoryKeyProvider`, `EnvironmentKeyProvider`, `KmsKeyProviderScaffold`, base64url/SPKI helpers.
- `src/lib/signature-verification.ts` — `createVerificationService(config)`, structured `VerificationResult`, closed `InvalidReason` enum.

**Modified library code**
- `src/lib/agent-gateway.ts` — extended `DecisionTokenPayload` (schema version, decision-record hash, tenant/org/policy fields, signing key id); added `createEd25519DecisionTokenSigner(keyProvider)`. `signDecisionToken`'s external contract (`Promise<string>`) is unchanged — the string is now a signed envelope, not a mock token.
- `src/lib/runtime-types.ts` — added optional `algorithm`/`signing_purpose` to `GatewayAcknowledgement` and `SigningAdapter` (optional so the pre-existing `MockSigningAdapter`, used by unrelated lower-level tests, needs no changes).
- `src/lib/runtime-gateway.ts` — added `Ed25519RuntimeSigningAdapter implements SigningAdapter`, wrapping a `KeyProvider` via `createCryptoSigningAdapter`.
- `src/lib/supplier-risk-runtime-pipeline.ts` — the GA-1 production path. Bootstraps an active signing key per purpose (`ensureActiveSigningKey`, using `KeyProvider.rotateSigningKey` as a generic "create if missing" — it degrades to create+activate when there is no current active key), then wires `createEd25519DecisionTokenSigner` and `Ed25519RuntimeSigningAdapter` in place of the previous `defaultSignDecisionToken` mock and `MockSigningAdapter`. Accepts an optional `keyProvider` dependency; defaults to a fresh `InMemoryKeyProvider` per call when not supplied — the pipeline never falls back to mock signing.
- `src/lib/evidence-pack-types.ts` / `src/lib/evidence-pack.ts` — added `EvidencePackManifestPayload`, `signEvidencePackManifest(pack, keyProvider, now)`, `attachEvidencePackSignature(pack, envelope | null)`. `buildEvidencePack()` itself stays synchronous and unsigned (its existing contract is untouched); the "Digital Signature" section now reads **"SIGNING NOT AVAILABLE"** by default instead of the old "not yet implemented" placeholder, and only shows `status: "complete"` when a real signed envelope was attached.
- `src/lib/trust-center.ts` — Signing/Evidence Pack/Security entries updated to reflect what is real and what remains BLOCKED (see Trust Center section below).
- `supabase/functions/deno.json` — import-map entries for the five new `src/lib` modules.

**New infrastructure**
- `supabase/migrations/20260710180000_ga3_signing_keys.sql` — `signing_keys` table: metadata and **public** key material only; `private_key_reference` is a nullable opaque pointer for a future KMS/Vault secret and is never populated with private key bytes by any code in this repository. RLS enabled, no policies (service-role only, matching the GA-2 durable-infrastructure pattern).
- `supabase/functions/verify-signed-artifact/index.ts` — HTTP verification endpoint.

**Tests**
- `src/test/crypto-signing.test.ts` (11), `src/test/key-management.test.ts` (15), `src/test/signature-verification.test.ts` (14) — unit coverage of the three core modules.
- `src/test/ga3-runtime-gateway-signing-integration.test.ts` (3) — real signing through `createRuntimeGateway().submitGatewayRequest()`.
- `src/test/ga3-supplier-risk-signing-integration.test.ts` (5) — proves the GA-1 production path emits a real, verifiable Ed25519 decision token and runtime acknowledgement, with no mock signature values.
- `src/test/ga3-evidence-pack-signing-integration.test.ts` (6) — signed-manifest generation, verification, tamper detection, honest unsigned default, JSON/HTML export behavior.

## Canonicalization model

`canonicalizePayload()` in `crypto-signing.ts` recursively sorts object keys, preserves array order exactly, and rejects any value with no single canonical textual form (`undefined`, functions, symbols, `bigint`, non-finite numbers, class instances such as `Date`/`Map`/`Set`) rather than silently coercing it. This is deliberately **not** `JSON.stringify` on its own — plain `JSON.stringify` preserves insertion order, which is not reproducible across two independent implementations building "the same" object. `canonicalPayloadHash()` layers a SHA-256 digest over the canonical form for payload-hash fields that don't themselves need a signature (e.g. Evidence Pack's `evidence_pack_hash`, which stays FNV-1a for backward compatibility with the pre-GA-3 pack format — only the new signed-manifest layer is SHA-256/Ed25519).

Signed envelopes always take the shape `{ payload: T, signature: SignatureBlock }`, and `signature` is never included in what gets canonicalized/signed — the signature is *about* the payload, never self-referential.

## Signing-provider architecture (dependency injection)

```text
Agent Gateway / Runtime Gateway / Evidence Pack / verify-signed-artifact
        │
        ▼
CryptoSigningAdapter          ← createCryptoSigningAdapter(keyProvider)
  canonicalize → resolve active key → sign/verify via KeyProvider
        │
        ▼
KeyProvider                   ← the only contract signing code depends on
        │
        ├── InMemoryKeyProvider        (real Ed25519 keys, ephemeral — tests/local only)
        ├── EnvironmentKeyProvider     (real Ed25519 keys from injected JWK config)
        └── KmsKeyProviderScaffold     (throws KeyProviderNotImplementedError — no real KMS/Vault wired)
```

`createCryptoSigningAdapter` is the **only** `CryptoSigningAdapter` implementation in the codebase — there is no mock variant. What differs between the three `KeyProvider`s is where private key material lives, never whether the cryptography is real: `InMemoryKeyProvider` and `EnvironmentKeyProvider` both generate/hold genuine Ed25519 keys via WebCrypto; only `KmsKeyProviderScaffold`'s signing operations are unimplemented, deliberately, because no real KMS/Vault credential is available in this environment.

## Key lifecycle

States: `PENDING → ACTIVE → RETIRED`, with independent `REVOKED`/`EXPIRED`. Exactly one `ACTIVE` key per `(purpose, environment)` (enforced by the in-process providers and by a partial unique index in the `signing_keys` migration). `RETIRED` keys remain valid for verification — rotation never invalidates history. `REVOKED` keys fail verification via `isKeyValidAt`. `EXPIRED` keys can neither sign nor verify. Purposes (`decision_token`, `runtime_acknowledgement`, `evidence_pack`, `audit_manifest`) are a closed enum recorded in both the key metadata and the signed payload — a key minted for one purpose is never accepted for another (`PURPOSE_MISMATCH`). Key IDs are immutable once minted (`deriveKeyId` uses a random UUID component rather than any positional slice of the key material, since Ed25519's SPKI DER encoding shares a fixed 12-byte header across all keys — an earlier draft of this function fingerprinted from that shared prefix and silently collided two same-millisecond keys; caught by `key-management.test.ts` and fixed before this work was integrated anywhere).

`rotateSigningKey(purpose, now)` creates a new key, retires the current active key (if any), and activates the new one; it degrades gracefully to plain create+activate when there is no current active key, which is what `ensureActiveSigningKey` in the Supplier Risk pipeline relies on for first-run bootstrap.

## Agent Gateway integration

`DecisionTokenPayload` now carries `token_schema_version`, `decision_id`, `decision_record_hash` (`hash` kept as a deprecated alias for backward compatibility), `tenant_id`, `organization_id`, `policy_id`, `policy_version`, `approval_state`, `issued_at`, `expiry`, `required_approvers`, `signing_key_id`. `createEd25519DecisionTokenSigner(keyProvider)` canonicalizes this payload and signs it with the provider's active `decision_token` key; the result is JSON-stringified into the same `Promise<string>` the pre-GA-3 mock signer returned, so no caller-facing contract changed. On the GA-1 Supplier Risk path, `buildAgentGatewayDependencies` now passes `now: () => input.now` into `AgentGatewayDependencies` — this was a required fix during integration: the token's `issued_at` must use the pipeline's own clock, not wall-clock time, because the bootstrapped key's activation window is relative to that same clock.

## Runtime Gateway integration

`Ed25519RuntimeSigningAdapter implements SigningAdapter`, wrapping a `KeyProvider` and a resolved active `runtime_acknowledgement` key id. `GatewayAcknowledgement` gained optional `algorithm`/`signing_purpose` fields (optional so the untouched `MockSigningAdapter`, still used by unrelated plumbing tests, needs no change). Verification (`verifyAcknowledgement`) re-canonicalizes the acknowledgement minus its `signature` field and checks it against the same `CryptoSigningAdapter` — an acknowledgement is never trusted until this check passes.

## Evidence Pack integration

`buildEvidencePack()` itself is untouched and stays synchronous/pure — it always produces an unsigned pack with an honest `"SIGNING NOT AVAILABLE"` Digital Signature section (`status: "unavailable"`). Two new, additive, async functions layer signing on top without touching that contract:

- `signEvidencePackManifest(pack, keyProvider, now)` builds a manifest (`evidence_pack_schema_version`, `evidence_pack_hash`, `decision_id`, `organization_id`, `generated_at`, `source_data_references`, `audit_references` — all derived only from data already present on the pack's own sections) and signs it with the provider's active `evidence_pack` key. It signs the **manifest**, never the rendered HTML/JSON directly.
- `attachEvidencePackSignature(pack, envelope | null)` returns a new pack with the Digital Signature section replaced by the signed manifest's public verification metadata (key id, algorithm, purpose, issued-at, signature bytes — never private material), or reverts to the honest unsigned state when passed `null`.

`evidencePackToJSON` needed no change — the signed manifest, once attached, is just another section and appears automatically. `evidencePackToHtml` needed no change either — it already renders every section's `summary` (which for a signed pack includes algorithm/key id/issued-at) but never a section's raw `data`, so raw signature bytes never appear in the HTML export.

**Not done in GA-3**: wiring this into the live `/evidence-pack/:decisionId` page. `EvidencePackPreview.tsx`/`EvidencePack.tsx` were left untouched per the task's "no unrelated UI" constraint — packs generated through the live page today still show the unsigned state. This is reported honestly in the Trust Center rather than claimed as deployed.

## Verification service

`createVerificationService({ keyProvider, now?, max_artifact_bytes?, signingAdapter? })` returns `verifySignedEnvelope` plus three purpose-bound convenience wrappers (`verifyDecisionToken`, `verifyRuntimeAcknowledgement`, `verifyEvidencePackManifest`). Every result is a structured `VerificationResult` (`valid`, `invalid_reason`, `key_id`, `algorithm`, `purpose`, `issued_at`, `expires_at`, `payload_hash`, `verification_timestamp`, `schema_version`) — it never returns or logs private key material, because it only ever consults `SigningKeyMetadata` (public-key-only by construction).

Checks, in order: request-size limit → envelope shape (zod) → algorithm/schema support → purpose match → tenant/organization match (when the payload carries those fields and the caller supplied expectations) → key resolution (`KEY_NOT_FOUND`) → key status (`KEY_REVOKED`/`KEY_EXPIRED`) → key validity at issuance time → artifact expiry → cryptographic verification (`SIGNATURE_INVALID`/`PAYLOAD_TAMPERED`).

**Important correctness note**: the three purpose-specific payload schemas (`DecisionTokenPayloadSchema`, `RuntimeAcknowledgementPayloadSchema`, `EvidencePackManifestPayloadSchema`) use zod's `.passthrough()`, not plain `z.object()`. This is required, not cosmetic — the canonical payload that was actually signed is *every* field the signer included, and zod's default behavior silently strips undeclared fields during `.safeParse()`. Without `.passthrough()`, the re-canonicalized bytes on the verify side would differ from what was signed and every otherwise-valid signature would fail as `PAYLOAD_TAMPERED`. This was caught by `ga3-runtime-gateway-signing-integration.test.ts` (an end-to-end test using a real signed payload) — a schema-only unit test using hand-built payloads matching the schema exactly would never have caught it.

## HTTP verification endpoint

`supabase/functions/verify-signed-artifact/index.ts`: accepts `{ artifact, expected_purpose, expected_tenant_id?, expected_organization_id?, environment? }`, validates the request shape and a 64 KiB size limit before parsing, applies the existing shared rate limiter (`_shared/rate-guard.ts`, `"public"` category, keyed by client IP), resolves public key material through a `SupabaseVerificationKeyProvider` (reads `signing_keys`; every method that would touch private material throws `KeyProviderNotImplementedError`, mirroring `KmsKeyProviderScaffold`), and returns the structured `VerificationResult`. It never accepts or returns private key data and never logs the full request body.

**Status: implemented, not deployment-validated.** No live Supabase project was available in this session to deploy against or to populate `signing_keys` with real rows, and no Deno CLI was available to run `deno check` locally (consistent with prior GA-1/GA-2/GA-2R sessions). This mirrors the GA-2R precedent: the code is real and self-contained, but live-environment validation is a separate, explicitly BLOCKED gate.

## Storage model

`signing_keys` (migration `20260710180000_ga3_signing_keys.sql`): `key_id` (unique), `purpose`, `algorithm` (constrained to `'Ed25519'`), `status`, `public_key` (base64url SPKI — never private), `private_key_reference` (nullable opaque pointer, never populated with actual private bytes by anything in this repository), `environment`, lifecycle timestamps, `revocation_reason`, `rotation_parent_key_id` (self-referencing FK), `metadata`. A partial unique index enforces exactly one `ACTIVE` row per `(purpose, environment)`. RLS is enabled with no policies — service-role only, identical to the GA-2 durable-infrastructure tables. `signed_artifact_registry` (mentioned as a possible table in the GA-3 task) was **not** built in this milestone — it wasn't required for any of the pass/fail gate's mandatory checks, and adding it speculatively would have been scope creep beyond "narrowly scoped."

This migration has not been applied to any live project in this session (no reachable Supabase target) — it is source-tree-verified (valid SQL, follows the established pattern) but deployment-unvalidated, same status as the GA-2R migration before it.

## Audit model

Key lifecycle events have a defined shape (`KeyLifecycleAuditEvent` in `key-management-types.ts`: `key.created`/`key.activated`/`key.rotated`/`key.retired`/`key.revoked`/`artifact.signed`/`artifact.verification_succeeded`/`artifact.verification_failed`), but GA-3 does not yet wire key-lifecycle operations into the existing `writeAuditEvent`/`audit_log` mechanism — this was judged out of the mandatory pass/fail gate (which requires signed artifacts and verification, not a fully wired audit trail for key management itself) and is called out here rather than silently omitted. No private key material appears in this type or in any audit payload produced by GA-3 code.

## Private-key protection

- Private key bytes are never returned by any public/read `KeyProvider` method (`getActiveSigningKey`, `getVerificationKey`, `listVerificationKeys` all return `SigningKeyMetadata`, which only carries `public_key`).
- `signWithKey` performs the private-key operation internally and returns only the resulting signature bytes.
- `EnvironmentKeyProvider` reads private key material only from injected config (a JWK), never a hardcoded secret, and never logs it.
- `signing_keys` never has a private-key column populated with real bytes; `private_key_reference` is an opaque pointer only.
- `VerificationResult` and every exported/logged artifact (JSON/HTML Evidence Pack exports, decision tokens, acknowledgements) carry only public verification metadata and signature bytes — verified directly by `ga3-evidence-pack-signing-integration.test.ts`'s and `signature-verification.test.ts`'s security assertions.
- The `verify-signed-artifact` endpoint's `SupabaseVerificationKeyProvider` throws on every method that would need private material (`signWithKey`, `rotateSigningKey`, `revokeSigningKey`).

## Tests

| File | Count | Covers |
|---|---|---|
| `src/test/crypto-signing.test.ts` | 11 | canonicalization determinism/key-order independence/unsupported values, Ed25519 sign/verify, tamper detection |
| `src/test/key-management.test.ts` | 15 | key lifecycle (create/activate/rotate/revoke/expire), one-active-key-per-purpose, retired keys still verify, `EnvironmentKeyProvider`, `KmsKeyProviderScaffold` scaffolding |
| `src/test/signature-verification.test.ts` | 14 | decision token / runtime acknowledgement verification scenarios, every `InvalidReason`, private-key-absence security check |
| `src/test/ga3-runtime-gateway-signing-integration.test.ts` | 3 | real signing through the actual Runtime Gateway |
| `src/test/ga3-supplier-risk-signing-integration.test.ts` | 5 | GA-1 production path: real signed decision token + acknowledgement, tamper/tenant-mismatch rejection, shared-key-provider behavior, default-provider bootstrap |
| `src/test/ga3-evidence-pack-signing-integration.test.ts` | 6 | honest unsigned default, real signed manifest + verification, tamper detection, no-active-key failure (never falls back to mock), JSON/HTML export content, revert-to-unsigned |

Two pre-existing tests were updated, not weakened, as a direct and correct consequence of Signing changing from "Not Implemented" to real: `src/test/trust-center.test.ts` and `src/test/scenario-template.test.ts` previously hardcoded the (now-stale) fact that Signing was `"Not Implemented"`; both now assert the true current state (`"Partially Implemented"`, and the Compliance Investigation scenario's readiness moving from "Requires Additional Capability" to "Ready for Demonstration").

## Trust Center

Updated truthfully per the task's explicit rule: **Implemented/Live In App** is never claimed here. `signing` is now `Partially Implemented` / `Live In App` — real Ed25519 signing is genuinely live for decision tokens and runtime acknowledgements on the GA-1 Supplier Risk path, which is enough to justify "Live In App" (a real consumer exists), but the entry explicitly states what remains unvalidated: no production KMS/Vault-backed private-key provider, Evidence Pack signing not wired into the live page, and the verification endpoint/migration deployment-unvalidated. `evidence_pack` and `evidence_export` entries were updated the same way. The Security dimension of the Enterprise Readiness matrix now describes GA-3 accurately instead of asserting "not implemented anywhere," while still stating the KMS/deployment BLOCKED status prominently.

## Verification commands

```bash
npm exec vitest run src/test/crypto-signing.test.ts
npm exec vitest run src/test/key-management.test.ts
npm exec vitest run src/test/signature-verification.test.ts
npm exec vitest run src/test/ga3-runtime-gateway-signing-integration.test.ts
npm exec vitest run src/test/ga3-supplier-risk-signing-integration.test.ts
npm exec vitest run src/test/ga3-evidence-pack-signing-integration.test.ts
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run build
git diff --check
```

All of the above passed in this session. `deno check` on `supabase/functions/verify-signed-artifact/index.ts` was **not run** — no Deno CLI is present in this sandbox (consistent with every prior GA-1/GA-2/GA-2R session). This is reported explicitly rather than silently skipped.

## Remaining GA blockers (explicitly BLOCKED, not claimed complete)

1. No real KMS/Vault/HSM-backed `KeyProvider` exists or was validated — `KmsKeyProviderScaffold` deliberately throws `KeyProviderNotImplementedError` on every private-key operation.
2. `signing_keys` migration is unapplied/unvalidated against any live Supabase project.
3. `verify-signed-artifact` edge function is implemented but not deployed or exercised against a live project; `deno check` could not be run (no Deno CLI available).
4. Evidence Pack manifest signing is a real library capability but is not wired into the live `/evidence-pack/:decisionId` page — packs generated through the UI remain unsigned today.
5. Key-lifecycle events are not yet wired into `audit_log` via the existing `writeAuditEvent` mechanism.
6. GA-2R's own live-Supabase validation gate (from the prior phase) remains separately BLOCKED and is unaffected by GA-3 — this session did not attempt to unblock it.

None of the above prevents GA-3's actual pass/fail gate from being met: real asymmetric signing, real verification, deterministic canonicalization, key rotation without invalidating history, revoked/expired-key enforcement, a signed-and-verifiable decision token and runtime acknowledgement on the live GA-1 Supplier Risk path, a signable-and-verifiable Evidence Pack manifest, no private-key leakage, and a fully passing test/typecheck/build suite are all true today. They are the honest boundary between "cryptography works" (true, tested) and "production key infrastructure is deployed" (not yet — by design, not oversight).

## MERGE RECOMMENDATION: GO

GA-3's implementation-scope pass/fail gate is met in full, with zero regressions across all 66 pre-existing + new test files (768 tests), a clean `tsc --noEmit`, and a clean production build. Live KMS/deployment validation is explicitly out of scope for this recommendation and remains a separate, clearly labeled release gate — exactly as GA-2R was handled.
