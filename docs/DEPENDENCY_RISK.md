# Dependency advisory risk

`npm audit` reported three advisories on June 25, 2026.

## Vite and esbuild

The direct Vite advisory and transitive esbuild advisory primarily affect the
development server. The automated fix requires Vite 8, which is a semver-major
upgrade and is outside the supported peer range of the current
`lovable-tagger` dependency (`>=5 <8`).

No safe in-range upgrade currently resolves these advisories. Mitigations:

- Never expose the Vite development server to an untrusted network.
- Bind local development to loopback unless remote access is explicitly
  required and protected.
- Build production assets in CI and serve only the static output.
- Re-evaluate Vite 8 after `lovable-tagger` declares compatibility and run the
  full browser and build suite before upgrading.

## xlsx

The `xlsx` package has high-severity prototype-pollution and ReDoS advisories,
and npm reports no fixed version. Production workbook parsing enters through
`src/lib/workbook-parser.ts`, so uploaded spreadsheet files are the affected
input path.

Current risk treatment:

- Treat all workbook uploads as untrusted input.
- Keep upload size, row, sheet, and processing-time limits enforced.
- Parse outside latency-sensitive UI work where possible.
- Reject unsupported extensions and malformed workbooks.
- Evaluate a maintained replacement or a supported SheetJS distribution.
- Add adversarial workbook fixtures before replacing the parser.

The risk remains open. The application must not claim that dependency
advisories are fully remediated while `xlsx` remains on this path.
