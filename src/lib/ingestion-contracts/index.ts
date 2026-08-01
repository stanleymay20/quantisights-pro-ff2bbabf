// Canonical ingestion contracts -- Phase 1 of the enterprise data
// platform program (see docs/audits/enterprise-data-platform-code-audit.md
// and docs/implementation/phase-1-canonical-contracts-plan.md).
//
// These contracts are additive: nothing in the existing DataUpload.tsx
// production flow has been rewired to use them yet. Compatibility
// adapters (./compat) convert real output from the legacy pipeline into
// these shapes so both can be tested against the same production
// functions without changing user-facing behavior.
export * from "./ids";
export * from "./checksum";
export * from "./errors";
export * from "./evidence";
export * from "./sampling";
export * from "./source-identity";
export * from "./parsed-tabular";
export * from "./field-profile";
export * from "./inference";
export * from "./compute-field-profile";
export * from "./infer-structural-roles";
