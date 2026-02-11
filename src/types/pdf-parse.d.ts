declare module 'pdf-parse' {
  function pdfParse(
    dataBuffer: Buffer,
    options?: { max?: number }
  ): Promise<{ numpages?: number; text?: string; [k: string]: unknown }>;
  export default pdfParse;
}
