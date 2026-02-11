import { parse } from 'csv-parse/sync';

const MAX_ROWS = 10000;
const MAX_CELL_LENGTH = 10000;

export type CsvResult = { text: string; warnings: string[] };

export async function extractCsv(buffer: Buffer): Promise<CsvResult> {
  const warnings: string[] = [];
  let text: string;
  try {
    const str = buffer.toString('utf-8').slice(0, 5_000_000);
    const rows = parse(str, { relax_column_count: true, skip_empty_lines: true, trim: true });
    const lines: string[] = [];
    let rowCount = 0;
    for (const row of rows) {
      if (rowCount >= MAX_ROWS) {
        warnings.push(`Truncated at ${MAX_ROWS} rows`);
        break;
      }
      const cells = Array.isArray(row) ? row : [row];
      const line = cells
        .map((c: unknown) => String(c ?? '').slice(0, MAX_CELL_LENGTH))
        .join(' | ');
      lines.push(line);
      rowCount++;
    }
    text = lines.join('\n');
  } catch (e) {
    return { text: '', warnings: ['CSV parse failed: ' + (e instanceof Error ? e.message : String(e))] };
  }
  return { text: text.trim() || '', warnings };
}
