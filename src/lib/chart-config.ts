/**
 * Shared chart configuration — industrial-standard consistency.
 *
 * Single source of truth for:
 * - Currency formatting
 * - Axis styling
 * - Tooltip styling
 * - Chart dimensions
 * - Number abbreviation
 * - Color palette (unified across all charts)
 */

/** Default currency symbol — configurable per org in the future */
export const CURRENCY_SYMBOL = "€";

/** Standard chart height in pixels */
export const CHART_HEIGHT = 260;

/**
 * Unified chart color palette — semantic tokens only.
 * Every chart MUST use these colors for consistency.
 *
 * Industry best practice: 2–6 core colors, high contrast, accessible.
 */
export const CHART_COLORS = {
  /** Primary metric / positive values / revenue */
  primary: "hsl(var(--primary))",
  /** Success / profit / growth */
  positive: "hsl(var(--success))",
  /** Negative / loss / decline */
  negative: "hsl(var(--destructive))",
  /** Warning / caution */
  warning: "hsl(var(--warning))",
  /** Uncertain / unstructured / low-confidence data */
  uncertain: "hsl(var(--muted-foreground))",
  /** Subtotal / intermediate values */
  subtotal: "hsl(var(--success))",
  /** Muted comparison (e.g., previous period) */
  comparison: "hsl(var(--muted-foreground))",
} as const;

/**
 * Sequential palette for categorical data (segments, pie slices).
 * Ordered by visual distinctiveness. Max 6 to avoid confusion.
 */
export const CHART_CATEGORICAL = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent))",
] as const;

/** Opacity levels for data confidence encoding */
export const CHART_OPACITY = {
  full: 0.85,
  muted: 0.55,
  uncertain: 0.35,
} as const;

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
