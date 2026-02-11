import { extractTxt } from './extractors/txt';
import { extractCsv } from './extractors/csv';
import { extractPdf } from './extractors/pdf';
import { extractDocx } from './extractors/docx';
import { extractDoc } from './extractors/doc';
import { extractXlsx } from './extractors/xlsx';
import { extractXls } from './extractors/xls';

export type ExtractResult = {
  text: string;
  warnings: string[];
  pageCount?: number;
  sheetCount?: number;
};

type ExtractorFn = (buf: Buffer) => Promise<{ text: string; warnings: string[]; pageCount?: number; sheetCount?: number }>;

const MIME_EXTRACTOR: Record<string, () => ExtractorFn> = {
  'text/plain': () => extractTxt,
  'application/pdf': () => extractPdf,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': () => extractDocx,
  'application/msword': () => extractDoc,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': () => extractXlsx,
  'application/vnd.ms-excel': () => extractXls,
  'text/csv': () => extractCsv,
};

const EXT_EXTRACTOR: Record<string, () => ExtractorFn> = {
  txt: () => extractTxt,
  pdf: () => extractPdf,
  docx: () => extractDocx,
  doc: () => extractDoc,
  xlsx: () => extractXlsx,
  xls: () => extractXls,
  csv: () => extractCsv,
};

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  ext?: string
): Promise<ExtractResult> {
  const normalizedMime = mimeType?.toLowerCase().split(';')[0].trim() ?? '';
  const normalizedExt = ext?.toLowerCase().replace(/^\./, '') ?? '';

  const byMime = MIME_EXTRACTOR[normalizedMime];
  const byExt = EXT_EXTRACTOR[normalizedExt];
  const fn = byMime?.() ?? byExt?.();

  const extractor = byMime?.() ?? byExt?.();
  if (!extractor) {
    return {
      text: '',
      warnings: [`Unsupported type: ${normalizedMime || 'unknown'} / ext: ${normalizedExt || 'unknown'}`],
    };
  }

  const result = await extractor(buffer);
  return {
    text: result.text ?? '',
    warnings: result.warnings ?? [],
    pageCount: result.pageCount,
    sheetCount: result.sheetCount,
  };
}
