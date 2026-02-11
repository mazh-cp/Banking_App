/**
 * Secure logging: redact PII and secrets from log messages. Use for audit and app logs.
 */

const REDACT_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,                    // SSN
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // card
  /\bsk-[a-zA-Z0-9]{20,}\b/gi,
  /\bsk-ant-[a-zA-Z0-9-]{20,}\b/gi,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /password["\s:=]+[^\s"}]+/gi,
  /last4["\s:=]+[\d]+/gi,
];

export function redactForLog(message: string): string {
  let out = message;
  for (const p of REDACT_PATTERNS) {
    out = out.replace(p, '[REDACTED]');
  }
  return out;
}

export function safeLog(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const redacted = redactForLog(message);
  const payload = meta ? { ...meta, _msg: redacted } : { _msg: redacted };
  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}
