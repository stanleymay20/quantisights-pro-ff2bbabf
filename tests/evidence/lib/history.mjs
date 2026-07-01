// tests/evidence/lib/history.mjs
// Safe append-only history for certification runs.
// - atomic write (temp file + rename)
// - corrupt file quarantined, never silently discarded
// - dedupe by (release, commit, environment, run_id)

import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";

function readOrQuarantine(historyPath) {
  if (!existsSync(historyPath)) return { history: [], quarantined: null };
  const raw = readFileSync(historyPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("history.json is not an array");
    return { history: parsed, quarantined: null };
  } catch (err) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantined = join(
      dirname(historyPath),
      `history.corrupt.${stamp}.json`,
    );
    renameSync(historyPath, quarantined);
    return { history: [], quarantined, error: String(err) };
  }
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}

function dedupeKey(entry) {
  return [
    entry.release ?? "",
    entry.commit ?? "",
    entry.environment ?? "",
    entry.run_id ?? "",
  ].join("|");
}

export function appendHistory(historyPath, entry) {
  const { history, quarantined, error } = readOrQuarantine(historyPath);
  const key = dedupeKey(entry);
  const filtered = history.filter((e) => dedupeKey(e) !== key);
  filtered.push(entry);
  atomicWrite(historyPath, JSON.stringify(filtered, null, 2));
  return { path: historyPath, count: filtered.length, quarantined, error };
}
