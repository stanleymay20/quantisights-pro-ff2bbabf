/**
 * AI Redaction Layer — strips PII / sensitive identifiers before sending text to LLMs.
 * Used by all edge functions that call external AI models.
 */

// Patterns for common PII
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;
const CREDIT_CARD_RE = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
const SSN_RE = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

interface RedactionResult {
  text: string;
  redactionsApplied: number;
}

export function redactPII(input: string): RedactionResult {
  let text = input;
  let count = 0;

  const replace = (re: RegExp, tag: string) => {
    const matches = text.match(re);
    if (matches) {
      count += matches.length;
      text = text.replace(re, `[${tag}]`);
    }
  };

  replace(EMAIL_RE, "EMAIL_REDACTED");
  replace(CREDIT_CARD_RE, "CARD_REDACTED");
  replace(IBAN_RE, "IBAN_REDACTED");
  replace(SSN_RE, "ID_REDACTED");
  replace(PHONE_RE, "PHONE_REDACTED");
  replace(UUID_RE, "ID_REDACTED");

  return { text, redactionsApplied: count };
}

/**
 * Checks org-level AI boundary setting. If raw text is disabled,
 * redacts PII before returning. If enabled, returns text as-is.
 */
export function applyAIBoundary(
  text: string,
  aiRawTextEnabled: boolean
): RedactionResult {
  if (aiRawTextEnabled) {
    return { text, redactionsApplied: 0 };
  }
  return redactPII(text);
}
