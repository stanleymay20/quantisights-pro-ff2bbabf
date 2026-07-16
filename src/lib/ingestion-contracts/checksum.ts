// Deterministic, dependency-free content checksum. Not cryptographic --
// used only to key sampling reproducibility and source identity, not for
// integrity/security guarantees (a real deployment would checksum the raw
// file bytes at upload time with a proper hash; this covers the in-memory
// parsed-content case Phase 1 operates on).
export function computeContentChecksum(input: string): string {
  // FNV-1a, 32-bit, run twice with different seeds and concatenated for a
  // wider effective hash than a single 32-bit pass -- still not
  // cryptographic, just cheap and stable.
  let h1 = 0x811c9dc5;
  let h2 = 0x12345678;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (h2 ^ c) + ((h2 << 6) + (h2 >>> 2));
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
