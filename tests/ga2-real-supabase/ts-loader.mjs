// Minimal Node ESM loader that transpiles the repo's TypeScript sources
// on the fly with esbuild, so these validation scripts can `import` the
// *actual* GA-2 adapter classes from src/lib/*.ts directly — no ts-node/tsx
// dependency, no reimplementation of adapter behavior.
//
// Usage: node --import ./tests/ga2-real-supabase/ts-loader.mjs <script>.mjs
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import * as esbuild from "esbuild";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const target = path.join(REPO_ROOT, "src", relative.endsWith(".ts") ? relative : `${relative}.ts`);
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  if (specifier.endsWith(".ts")) {
    return nextResolve(specifier, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf8");
    const result = await esbuild.transform(source, {
      loader: "ts",
      format: "esm",
      target: "es2022",
      sourcefile: filePath,
    });
    return { format: "module", source: result.code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
