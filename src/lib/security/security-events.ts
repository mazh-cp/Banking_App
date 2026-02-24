/**
 * Redacted audit event logger for Lakera Guard gateway.
 * Writes to data/security-events.jsonl (append-only). Never raw PII or raw prompts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { LakeraStage } from './lakera-types';

export type SecurityEventPayload = {
  ts: string;
  correlationId: string;
  userId: string | 'anonymous';
  stage: LakeraStage;
  action: string;
  reasonCodes: string[];
  unknownDomains?: string[];
  redactedPreview?: string;
  lakeraAvailable: boolean;
  modelUsed?: string;
};

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'security-events.jsonl');

function redactedPreview(text: string | undefined, max = 200): string {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function logSecurityEvent(payload: Omit<SecurityEventPayload, 'ts'>): Promise<void> {
  const event: SecurityEventPayload = {
    ...payload,
    ts: new Date().toISOString(),
    redactedPreview: payload.redactedPreview ?? redactedPreview(payload.redactedPreview),
  };
  if (event.redactedPreview && event.redactedPreview.length > 200) {
    event.redactedPreview = event.redactedPreview.slice(0, 200);
  }
  const line = JSON.stringify(event) + '\n';
  const dir = path.dirname(DEFAULT_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(DEFAULT_PATH, line);
  } catch (e) {
    console.error('security-events write failed:', e);
  }
}

export function getSecurityEventsPath(): string {
  return DEFAULT_PATH;
}

export type SecurityEventRow = SecurityEventPayload;

/** Read last N events from jsonl (for admin page). Returns newest first. */
export async function readLastSecurityEvents(limit: number): Promise<SecurityEventRow[]> {
  try {
    const content = await fs.readFile(DEFAULT_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const parsed: SecurityEventRow[] = [];
    for (let i = lines.length - 1; i >= 0 && parsed.length < limit; i--) {
      try {
        parsed.push(JSON.parse(lines[i]) as SecurityEventRow);
      } catch {
        // skip malformed line
      }
    }
    return parsed;
  } catch {
    return [];
  }
}
