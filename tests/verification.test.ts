/**
 * Identity verification (SSN last 4) and sensitive-request classifier tests.
 * Run: pnpm exec tsx tests/verification.test.ts
 *
 * Lockout test requires DB: 3 failures => status.verified false, reason 'locked'.
 */

import {
  isSensitiveRequest,
  isVerificationAttempt,
  getVerificationStatus,
  setVerified,
  recordVerificationFailure,
} from '../src/lib/chat/verification';
import { validateLast4, hashLast4, verifyLast4 } from '../src/lib/security/ssn-last4';
import { isAccountSpecificQuery } from '../src/lib/ai/intent';
import { prisma } from '../src/lib/db';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isSensitiveRequest("What's my checking balance?"), 'balance is sensitive');
assert(isAccountSpecificQuery("What's my checking balance?"), 'intent: balance is account-specific');
assert(isSensitiveRequest('Show my recent transactions'), 'transactions is sensitive');
assert(!isSensitiveRequest('What is the weather?'), 'weather is not sensitive');

assert(isVerificationAttempt('1234'), '1234 is verification attempt');
assert(!isVerificationAttempt('123'), '123 is not 4 digits');

assert(validateLast4('1234'), '1234 valid');
assert(!validateLast4('12a4'), '12a4 invalid');

async function run() {
  const hash = await hashLast4('1234');
  assert(!!hash && hash.length > 0, 'hashLast4 returns non-empty string');
  const ok = await verifyLast4('1234', hash);
  assert(ok, 'verifyLast4 matches');
  const bad = await verifyLast4('0000', hash);
  assert(!bad, 'verifyLast4 rejects wrong digits');

  const user = await prisma.user.findFirst({ where: { role: 'customer' }, select: { id: true } });
  if (user) {
    await setVerified(user.id);
    const after = await getVerificationStatus(user.id);
    assert(after.verified === true, 'after setVerified, status is verified');

    await recordVerificationFailure(user.id);
    await recordVerificationFailure(user.id);
    const { locked } = await recordVerificationFailure(user.id);
    assert(locked === true, '3rd failure triggers lockout');
    const statusLocked = await getVerificationStatus(user.id);
    assert(statusLocked.verified === false && statusLocked.reason === 'locked', 'status is locked');
  }

  await prisma.$disconnect();
  console.log('Verification tests passed.');
  process.exit(0);
}
run().catch(async (e) => {
  await prisma.$disconnect();
  console.error(e);
  process.exit(1);
});
