import mammoth from 'mammoth';

export type DocxResult = { text: string; warnings: string[] };

export async function extractDocx(buffer: Buffer): Promise<DocxResult> {
  const warnings: string[] = [];
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value ?? '').trim();
    if (result?.messages?.length) {
      warnings.push(...result.messages.map((m: { message: string }) => m.message));
    }
    if (!text) warnings.push('No text content extracted from DOCX');
    return { text, warnings };
  } catch (e) {
    return {
      text: '',
      warnings: ['DOCX extraction failed: ' + (e instanceof Error ? e.message : String(e))],
    };
  }
}
