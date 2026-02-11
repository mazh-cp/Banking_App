declare module 'adm-zip' {
  class AdmZip {
    constructor(path?: string | Buffer);
    getEntries(): { entryName: string; isDirectory: boolean; getData(): Buffer }[];
    getEntry(name: string): { getData(): Buffer } | null;
  }
  export = AdmZip;
}
