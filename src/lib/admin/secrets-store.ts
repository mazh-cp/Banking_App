import { prisma } from '@/lib/db';
import { decrypt, hasEncryptionKey } from '@/lib/security/secrets';

const SECRET_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LAKERA_API_KEY'] as const;
const CONFIG_KEYS = ['LAKERA_PROJECT_ID', 'LAKERA_INPUT_VALIDATION_ENABLED', 'LAKERA_OUTPUT_VALIDATION_ENABLED'] as const;

export type SecretKeyName = (typeof SECRET_KEYS)[number];
export type ConfigKeyName = (typeof CONFIG_KEYS)[number];

/**
 * Get API key from DB (decrypted) or fallback to env. Server-only; never send to client.
 */
export async function getSecret(keyName: SecretKeyName): Promise<string | null> {
  if (hasEncryptionKey()) {
    const row = await prisma.appSecret.findUnique({ where: { keyName } });
    if (row) {
      try {
        return decrypt({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
      } catch {
        return null;
      }
    }
  }
  const envMap: Record<SecretKeyName, string> = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
    LAKERA_API_KEY: process.env.LAKERA_GUARD_API_KEY ?? process.env.LAKERA_API_KEY ?? '',
  };
  const v = envMap[keyName];
  return v && v.length > 0 ? v : null;
}

/**
 * Get config value from DB or env. Server-only.
 */
export async function getConfig(configName: ConfigKeyName): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { configName } });
  if (row?.value) return row.value;
  if (configName === 'LAKERA_PROJECT_ID') return process.env.LAKERA_PROJECT_ID ?? null;
  if (configName === 'LAKERA_INPUT_VALIDATION_ENABLED' || configName === 'LAKERA_OUTPUT_VALIDATION_ENABLED') return row?.value ?? 'true';
  return null;
}

export { SECRET_KEYS, CONFIG_KEYS };
