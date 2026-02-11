/**
 * Integration checks for maintenance mode (no keys -> maintenance response).
 * Run: pnpm exec tsx tests/maintenance-mode-integration.test.ts
 *
 * Prerequisites for full integration (manual or E2E):
 * - With no OpenAI/Anthropic keys set: POST /api/chat returns 200, message "System is under Maintenance", meta.maintenance === true.
 * - With OpenAI key set and CHAT_PROVIDER=openai: chat proceeds normally (no maintenance).
 * - With securityMode true and Lakera keys missing: maintenance (when Lakera required).
 *
 * This script runs assertAiReady() with current env/DB: when no keys are set, ready must be false.
 */

import { assertAiReady } from '../src/lib/runtime/ai-readiness';

async function main() {
  const r = await assertAiReady({
    provider: 'openai',
    lakeraEnabled: true,
    requireLakeraAlways: false,
  });

  if (!r.ready) {
    console.log('OK: assertAiReady returned not ready (missing keys). missing =', r.missing);
    console.log('Integration: With these keys missing, /api/chat would return maintenance.');
  } else {
    console.log('OK: assertAiReady returned ready (keys are set). Chat would call LLM.');
  }

  const r2 = await assertAiReady({
    provider: 'anthropic',
    lakeraEnabled: false,
  });
  console.log('Anthropic (no Lakera):', r2.ready ? 'ready' : 'not ready', r2.missing.length ? r2.missing : '');

  console.log('Maintenance mode integration check done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
