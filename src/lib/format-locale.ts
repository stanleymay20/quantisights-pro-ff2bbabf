/**
 * Locale-aware formatting utilities for the German market (and all supported locales).
 * Uses Intl APIs for proper number, currency, date, and percentage formatting.
 */

/** Get the active BCP-47 locale tag */
export function getActiveLocale(): string {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("i18nextLng");
  const lang = stored?.split("-")[0] || navigator.language?.split("-")[0] || "en";
  // Map short codes to full BCP-47 for Intl
  const localeMap: Record<string, string> = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
    es: "es-ES",
    ar: "ar-SA",
  };
  return localeMap[lang] || `${lang}-${lang.toUpperCase()}`;
}

/** Format a number with locale-appropriate separators (e.g., 1.234,56 for German) */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getActiveLocale(), {
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

/** Format currency (defaults to EUR for German locale) */
export function formatCurrency(
  value: number,
  currency?: string
): string {
  const locale = getActiveLocale();
  const cur = currency || (locale.startsWith("de") ? "EUR" : "USD");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a percentage (e.g., 0.156 → "15,6 %" in German) */
export function formatPercent(
  value: number,
  fractionDigits = 1
): string {
  return new Intl.NumberFormat(getActiveLocale(), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Format a date (e.g., "25.02.2026" in German, "02/25/2026" in US) */
export function formatDate(
  date: Date | string,
  style: "short" | "medium" | "long" = "medium"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const opts: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric" }
      : style === "long"
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(getActiveLocale(), opts).format(d);
}

/** Format date + time */
export function formatDateTime(
  date: Date | string,
  includeSeconds = false
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  }).format(d);
}

/** Format compact numbers (e.g., 1,2 Mio. for German, 1.2M for English) */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat(getActiveLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
