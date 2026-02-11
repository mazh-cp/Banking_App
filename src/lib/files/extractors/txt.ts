export type TxtResult = { text: string; warnings: string[] };

export async function extractTxt(buffer: Buffer): Promise<TxtResult> {
  const warnings: string[] = [];
  let text: string;
  try {
    text = buffer.toString('utf-8');
  } catch {
    try {
      text = buffer.toString('latin1');
      warnings.push('Encoding may be non-UTF-8 (used latin1 fallback)');
    } catch {
      return { text: '', warnings: ['Could not decode as UTF-8 or latin1'] };
    }
  }
  if (!text || !text.trim()) {
    warnings.push('File is empty or whitespace-only');
  }
  return { text: text.trim(), warnings };
}
