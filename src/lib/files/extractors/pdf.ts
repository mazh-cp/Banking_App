// Dynamic require for pdf-parse (CommonJS)
export type PdfResult = { text: string; warnings: string[]; pageCount?: number };

export async function extractPdf(buffer: Buffer): Promise<PdfResult> {
  const warnings: string[] = [];
  try {
    const mod = await import('pdf-parse');
    const fn = (mod as { default?: (b: Buffer, o?: { max?: number }) => Promise<{ text?: string; numpages?: number }> }).default ?? mod;
    const data = await (fn as (b: Buffer, o?: { max?: number }) => Promise<{ text?: string; numpages?: number }>)(buffer, { max: 0 });
    const text = (data?.text ?? '').trim();
    const pageCount = typeof data?.numpages === 'number' ? data.numpages : undefined;
    if (!text) warnings.push('No text content extracted from PDF');
    return { text, warnings, pageCount };
  } catch (e) {
    return {
      text: '',
      warnings: ['PDF extraction failed: ' + (e instanceof Error ? e.message : String(e))],
    };
  }
}
