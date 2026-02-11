/**
 * Redact PII before writing to DB or logs. Keeps structure, masks values.
 */

const SSN_REGEX = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;
const CARD_REGEX = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export function redactPii(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(SSN_REGEX, '***-**-****')
    .replace(CARD_REGEX, '****-****-****-****')
    .replace(EMAIL_REGEX, (m) => m.slice(0, 2) + '***@' + m.split('@')[1]);
}

export function redactForAuditPreview(content: string, maxLen = 500): string {
  return redactPii(content).slice(0, maxLen);
}
