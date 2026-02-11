import * as XLSX from 'xlsx';

const MAX_SHEETS = 50;
const MAX_CELL_LENGTH = 5000;

export type XlsResult = { text: string; warnings: string[]; sheetCount?: number };

export async function extractXls(buffer: Buffer): Promise<XlsResult> {
  const warnings: string[] = [];
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true });
    const sheetNames = wb.SheetNames.slice(0, MAX_SHEETS);
    const parts: string[] = [];
    for (const name of sheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as unknown[][];
      for (const row of rows) {
        const line = (Array.isArray(row) ? row : [row])
          .map((c) => String(c ?? '').slice(0, MAX_CELL_LENGTH))
          .join(' | ');
        if (line.trim()) parts.push(line);
      }
    }
    const text = parts.join('\n').trim();
    warnings.push('XLS (Excel 97-2003) support may be limited');
    return { text, warnings, sheetCount: sheetNames.length };
  } catch (e) {
    return {
      text: '',
      warnings: ['XLS extraction failed: ' + (e instanceof Error ? e.message : String(e))],
    };
  }
}
