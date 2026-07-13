import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitestCli = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);

const result = spawnSync(
  process.execPath,
  [vitestCli, "run", "src/lib/certification/certification.test.ts"],
  {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      QV_CERTIFY_FULL: "1",
    },
  },
);

if (result.error) {
  console.error(`Unable to start the full certification suite: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
