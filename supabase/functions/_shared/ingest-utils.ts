export function toDateOnly(value: string): string {
  return new Date(value).toISOString().split("T")[0];
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeDateInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}$/.test(raw)) {
    return `${raw}-01-01`;
  }

  if (Number.isNaN(Date.parse(raw))) {
    return null;
  }

  return raw;
}

export async function parseJsonBody(req: Request): Promise<{ body?: unknown; error?: string }> {
  try {
    const body = await req.json();
    return { body };
  } catch {
    return { error: "Invalid JSON body" };
  }
}
