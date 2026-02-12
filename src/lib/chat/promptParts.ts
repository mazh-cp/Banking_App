/**
 * Standardized formatting for trusted tool output injection into system prompt.
 */

export function formatTrustedToolOutput(
  toolName: string,
  payload: unknown,
  options?: { userId?: string; timestamp?: string }
): string {
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const userIdNote = options?.userId ? ` (userId: internal)` : '';
  return [
    `[AUTHORITATIVE TOOL OUTPUT]`,
    `Tool: ${toolName}${userIdNote}`,
    `Timestamp: ${timestamp}`,
    `Data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
  ].join('\n');
}
