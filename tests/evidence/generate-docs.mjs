#!/usr/bin/env node
// tests/evidence/generate-docs.mjs
// Validate (or generate) docs/enterprise/RELEASE_GATE.md against
// tests/evidence/lib/gates.mjs. gates.mjs is the single source of truth.
//
// Modes:
//   --check   (default) validate: exit 1 on drift, print diff
//   --write   regenerate RELEASE_GATE.md between the AUTO-GENERATED markers
//
// EVIDENCE_MATRIX.md is validated (not regenerated): every gate label in
// gates.mjs must appear in the matrix.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GATES, TOTAL_WEIGHT } from "./lib/gates.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const RELEASE_GATE_PATH = join(REPO_ROOT, "docs/enterprise/RELEASE_GATE.md");
const MATRIX_PATH = join(REPO_ROOT, "docs/enterprise/EVIDENCE_MATRIX.md");

const START = "<!-- AUTO-GENERATED:GATES:START (do not edit — run npm run evidence:docs) -->";
const END = "<!-- AUTO-GENERATED:GATES:END -->";

function renderGatesBlock() {
  const lines = [
    START,
    "",
    "## Gate definition (generated from `tests/evidence/lib/gates.mjs`)",
    "",
    "Scoring model: weights do not need to sum to 100. The Enterprise",
    `Readiness Score is normalized to 0-100 against TOTAL_WEIGHT = ${TOTAL_WEIGHT}.`,
    "Gates with weight 0 are hard-blocking but do not contribute to the score.",
    "",
    "| Gate key | Label | Weight | Pipelines |",
    "|---|---|---:|---|",
  ];
  for (const g of GATES) {
    lines.push(
      `| \`${g.key}\` | ${g.label} | ${g.weight} | ${g.pipelines.map((p) => `\`${p}\``).join(", ")} |`,
    );
  }
  lines.push("", `**Total weight (score denominator):** ${TOTAL_WEIGHT}`, "", END);
  return lines.join("\n");
}

function upsertBlock(existing, block) {
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + block + existing.slice(e + END.length);
  }
  return existing.trimEnd() + "\n\n" + block + "\n";
}

function validateMatrixMentionsGates() {
  if (!existsSync(MATRIX_PATH)) {
    return [`EVIDENCE_MATRIX.md missing at ${MATRIX_PATH}`];
  }
  const matrix = readFileSync(MATRIX_PATH, "utf8");
  const errors = [];
  for (const g of GATES) {
    if (!matrix.includes(g.label)) {
      errors.push(`EVIDENCE_MATRIX.md missing gate label "${g.label}"`);
    }
  }
  return errors;
}

function main() {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const block = renderGatesBlock();
  const existing = existsSync(RELEASE_GATE_PATH)
    ? readFileSync(RELEASE_GATE_PATH, "utf8")
    : "";
  const next = upsertBlock(existing, block);
  const matrixErrors = validateMatrixMentionsGates();

  if (mode === "write") {
    writeFileSync(RELEASE_GATE_PATH, next);
    console.log(`[docs] wrote ${RELEASE_GATE_PATH}`);
    if (matrixErrors.length) {
      for (const e of matrixErrors) console.warn(`[docs] WARN ${e}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const drift = existing !== next;
  const errors = [];
  if (drift) errors.push("RELEASE_GATE.md drifts from gates.mjs (run: npm run evidence:docs:write)");
  errors.push(...matrixErrors);

  if (errors.length) {
    for (const e of errors) console.error(`[docs] ${e}`);
    process.exit(1);
  }
  console.log("[docs] gates.mjs and enterprise docs are in sync");
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
