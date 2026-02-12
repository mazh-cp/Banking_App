/**
 * Detect if user message is explicit confirmation or cancel for pending actions.
 */

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isConfirmMessage(message: string): boolean {
  const n = normalize(message);
  if (n.length > 20) return false;
  const confirmPatterns = [
    /^yes$/i,
    /^confirm$/i,
    /^yeah$/i,
    /^yep$/i,
    /^proceed$/i,
    /^do it$/i,
    /^go ahead$/i,
    /^confirm transfer$/i,
    /^confirm it$/i,
  ];
  return confirmPatterns.some((p) => p.test(n));
}

export function isCancelMessage(message: string): boolean {
  const n = normalize(message);
  if (n.length > 30) return false;
  const cancelPatterns = [
    /^no$/i,
    /^cancel$/i,
    /^nevermind$/i,
    /^never mind$/i,
    /^nope$/i,
    /^don't do it$/i,
    /^do not do it$/i,
    /^abort$/i,
  ];
  return cancelPatterns.some((p) => p.test(n));
}
