/**
 * Chat greeting and branding tests.
 * Run: pnpm exec tsx tests/chat-greeting.test.ts
 *
 * Integration (manual or E2E):
 * - Load /chat with empty conversation -> greeting appears once with "Welcome to FinGuard Banking Systems, <Name>."
 * - Refresh -> greeting still appears once (no duplicate)
 * - Send a message -> LLM response works; assistant label is "Ava (FinGuard Assistant)"
 */

import {
  BRAND_NAME,
  ASSISTANT_DISPLAY_NAME,
  ASSISTANT_FULL_NAME,
  DEFAULT_GREETING,
} from '../src/lib/config/branding';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(BRAND_NAME === 'FinGuard Banking Systems', 'BRAND_NAME');
assert(ASSISTANT_DISPLAY_NAME === 'Ava', 'ASSISTANT_DISPLAY_NAME');
assert(ASSISTANT_FULL_NAME === 'Ava (FinGuard Assistant)', 'ASSISTANT_FULL_NAME');

const withName = DEFAULT_GREETING('Alice');
assert(withName.includes('FinGuard Banking Systems'), 'greeting includes brand');
assert(withName.includes('Alice'), 'greeting includes name');
assert(withName.endsWith('How can I help you today?'), 'greeting ends with prompt');

const noName = DEFAULT_GREETING();
assert(noName.includes('FinGuard Banking Systems'), 'no-name greeting includes brand');
assert(!noName.includes(', ,'), 'no-name has no empty comma');
assert(noName.endsWith('How can I help you today?'), 'no-name ends with prompt');

console.log('Chat greeting / branding tests passed.');
process.exit(0);
