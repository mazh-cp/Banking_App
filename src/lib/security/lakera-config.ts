/**
 * Typed Lakera Guard config from env.
 * Mode: enforce | monitor | off. Default enforce in prod.
 */

const LAKERA_MODE = (process.env.LAKERA_MODE ?? 'enforce').toLowerCase();
const LAKERA_FAIL_OPEN = process.env.LAKERA_FAIL_OPEN === 'true';
const LAKERA_ALLOWED_DOMAINS_RAW = process.env.LAKERA_ALLOWED_DOMAINS ?? '';

export const lakeraConfig = {
  baseUrl: (process.env.LAKERA_API_BASE ?? 'https://api.lakera.ai/v2').replace(/\/$/, ''),
  apiKey: process.env.LAKERA_GUARD_API_KEY || process.env.LAKERA_API_KEY || '',
  projectId: process.env.LAKERA_PROJECT_ID ?? '',
  mode: (LAKERA_MODE === 'monitor' ? 'monitor' : LAKERA_MODE === 'off' ? 'off' : 'enforce') as 'enforce' | 'monitor' | 'off',
  failOpen: LAKERA_FAIL_OPEN,
  allowedDomains: LAKERA_ALLOWED_DOMAINS_RAW
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** True when mode is not "off" (screening is active). */
export const LAKERA_ENABLED = lakeraConfig.mode !== 'off';

/** Validate required values when mode !== "off". Caller can use for startup check. */
export function validateLakeraConfig(): { valid: boolean; missing?: string[] } {
  if (lakeraConfig.mode === 'off') return { valid: true };
  const missing: string[] = [];
  if (!lakeraConfig.apiKey) missing.push('LAKERA_GUARD_API_KEY or LAKERA_API_KEY');
  return missing.length ? { valid: false, missing } : { valid: true };
}
