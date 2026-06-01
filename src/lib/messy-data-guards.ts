export const NULL_LIKE_VALUES = new Set([
  '', 'null', 'NULL', 'n/a', 'N/A', 'na', 'NA', '-', '--', 'unknown', 'UNKNOWN', '(blank)'
]);

export function normalizeMissingValue(value: string | undefined | null): string {
  if (value == null) return '';
  const trimmed = value.trim();
  return NULL_LIKE_VALUES.has(trimmed) ? '' : trimmed;
}

export function isBooleanLike(value: string | undefined): boolean {
  if (!value) return false;
  return /^(true|false|yes|no|y|n|0|1)$/i.test(value.trim());
}

export function isIdentifierLike(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return (
    /^[A-Z]{2,}-\d+$/i.test(v) ||
    /^[a-f0-9]{8}-[a-f0-9]{4}/i.test(v) ||
    /^[A-Z0-9_-]{6,}$/i.test(v)
  );
}

export function parseEuropeanNumber(value: string | undefined): number {
  if (!value) return Number.NaN;
  const normalized = value.trim()
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(normalized);
}

export function isExcelSerialDate(value: string | undefined): boolean {
  if (!value) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 20000 && n < 60000;
}

export function excelSerialToIsoDate(serial: number): string {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  return date.toISOString().slice(0, 10);
}

export function deduplicateHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);
    return count === 1 ? header : `${header}_${count}`;
  });
}
