// Compatibility adapters: convert real, production legacy-pipeline output
// into canonical contracts, without modifying the legacy functions or the
// live DataUpload.tsx flow. See ../../../docs/implementation/phase-1-canonical-contracts-plan.md.
export * from "./from-parsed-csv";
export * from "./from-legacy-schema";
export * from "./from-semantic-classification";
export * from "./from-diagnostics";
