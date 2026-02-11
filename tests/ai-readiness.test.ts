/**
 * Unit tests for AI readiness (maintenance mode).
 * Run: pnpm exec tsx tests/ai-readiness.test.ts
 */

import { checkAiReadyFromConfig, type RuntimeConfig, type AiReadinessContext } from '../src/lib/runtime/ai-readiness';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const emptyConfig: RuntimeConfig = {
  openaiApiKey: null,
  anthropicApiKey: null,
  lakeraApiKey: null,
  lakeraProjectId: null,
};

const fullConfig: RuntimeConfig = {
  openaiApiKey: 'sk-x',
  anthropicApiKey: 'sk-ant-x',
  lakeraApiKey: 'lk-x',
  lakeraProjectId: 'proj-1',
};

// No keys set, OpenAI provider -> not ready, missing OPENAI_API_KEY
let r = checkAiReadyFromConfig(emptyConfig, { provider: 'openai', lakeraEnabled: false });
assert(!r.ready, 'openai no keys: not ready');
assert(r.missing.includes('OPENAI_API_KEY'), 'openai no keys: missing OPENAI_API_KEY');
assert(r.reason.includes('OpenAI key'), 'reason mentions OpenAI key');

// No keys set, Anthropic provider -> not ready, missing ANTHROPIC_API_KEY
r = checkAiReadyFromConfig(emptyConfig, { provider: 'anthropic', lakeraEnabled: false });
assert(!r.ready, 'anthropic no keys: not ready');
assert(r.missing.includes('ANTHROPIC_API_KEY'), 'anthropic no keys: missing ANTHROPIC_API_KEY');

// OpenAI set, Lakera not required -> ready
r = checkAiReadyFromConfig(
  { ...emptyConfig, openaiApiKey: 'sk-ok' },
  { provider: 'openai', lakeraEnabled: false }
);
assert(r.ready, 'openai set, no lakera: ready');
assert(r.missing.length === 0, 'no missing');

// OpenAI set, Lakera required but not set -> not ready
r = checkAiReadyFromConfig(
  { ...emptyConfig, openaiApiKey: 'sk-ok' },
  { provider: 'openai', lakeraEnabled: true }
);
assert(!r.ready, 'openai set but lakera required: not ready');
assert(r.missing.includes('LAKERA_API_KEY') || r.missing.includes('LAKERA_PROJECT_ID'), 'missing Lakera');

// Full config, Lakera required -> ready
r = checkAiReadyFromConfig(fullConfig, { provider: 'openai', lakeraEnabled: true });
assert(r.ready, 'full config with lakera: ready');

// requireLakeraAlways: Lakera required even when lakeraEnabled false
r = checkAiReadyFromConfig(
  { ...emptyConfig, openaiApiKey: 'sk-ok' },
  { provider: 'openai', lakeraEnabled: false, requireLakeraAlways: true }
);
assert(!r.ready, 'requireLakeraAlways: not ready without Lakera');

// Empty string keys treated as missing
r = checkAiReadyFromConfig(
  { openaiApiKey: '  ', anthropicApiKey: null, lakeraApiKey: null, lakeraProjectId: null },
  { provider: 'openai', lakeraEnabled: false }
);
assert(!r.ready && r.missing.includes('OPENAI_API_KEY'), 'whitespace-only key counts as missing');

console.log('AI readiness tests passed.');
process.exit(0);
