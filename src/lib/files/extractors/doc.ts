import mammoth from 'mammoth';

export type DocResult = { text: string; warnings: string[]; partial?: boolean };

export async function extractDoc(buffer: Buffer): Promise<DocResult> {
  const warnings: string[] = [];
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value ?? '').trim();
    if (result?.messages?.length) {
      warnings.push(...result.messages.map((m: { message: string }) => m.message));
      warnings.push('DOC support may be partial; some content could be missing');
    }
    return { text, warnings, partial: !text || result?.messages?.length > 0 };
  } catch (e) {
    return {
      text: '',
      warnings: ['DOC extraction failed (format may be unsupported): ' + (e instanceof Error ? e.message : String(e))],
      partial: true,
    };
  }
}
