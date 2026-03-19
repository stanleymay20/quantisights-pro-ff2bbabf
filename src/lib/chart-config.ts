/**
 * Shared chart configuration — industrial-standard consistency.
 *
 * Single source of truth for:
 * - Currency formatting
 * - Axis styling
 * - Tooltip styling
 * - Chart dimensions
 * - Number abbreviation
 */

/** Default currency symbol — configurable per org in the future */
export const CURRENCY_SYMBOL = "€";

/** Standard chart height in pixels */
export const CHART_HEIGHT = 260;

/** Format a number with currency and abbreviation */
export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (opts?.compact !== false) {
    if (abs >= 1e9) return `${sign}${CURRENCY_SYMBOL}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${CURRENCY_SYMBOL}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${CURRENCY_SYMBOL}${(abs / 1e3).toFixed(0)}K`;
  }
  return `${sign}${CURRENCY_SYMBOL}${abs.toLocaleString()}`;
}

/** Format a number without currency */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toLocaleString();
}

/** Shared axis styling */
export const axisStyle = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false as const,
  axisLine: false as const,
};

/** Shared tooltip container style */
export const tooltipStyle: React.CSSProperties = {
  fontSize: 11,
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
};

/** Shared grid style */
export const gridStyle = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  strokeOpacity: 0.6,
};
