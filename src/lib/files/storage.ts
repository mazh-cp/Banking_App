import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads');

export function getUploadDir(userId: string): string {
  return path.join(UPLOAD_BASE, userId);
}

export function getStoragePath(userId: string, fileId: string, ext: string): string {
  return path.join(getUploadDir(userId), `${fileId}${ext ? '.' + ext.replace(/^\./, '') : ''}`);
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function storeFile(storagePath: string, buffer: Buffer): Promise<void> {
  await ensureDir(path.dirname(storagePath));
  await writeFile(storagePath, buffer);
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
