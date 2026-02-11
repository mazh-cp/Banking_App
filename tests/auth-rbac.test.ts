/**
 * Auth and RBAC unit checks (no server).
 * Run: pnpm exec tsx tests/auth-rbac.test.ts
 */

import {
  canAccessAdmin,
  canModifySettings,
  canSubmitApplication,
  canUploadFiles,
  isReadOnly,
} from '../src/lib/auth/rbac';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canAccessAdmin('admin'), 'admin can access admin');
assert(!canAccessAdmin('customer'), 'customer cannot access admin');
assert(!canAccessAdmin('readonly'), 'readonly cannot access admin');

assert(canModifySettings('admin'), 'admin can modify settings');
assert(!canModifySettings('customer'), 'customer cannot modify settings');

assert(canSubmitApplication('customer'), 'customer can submit application');
assert(!canSubmitApplication('readonly'), 'readonly cannot submit application');
assert(!canSubmitApplication('admin'), 'admin cannot submit application (customer-only)');

assert(canUploadFiles('customer'), 'customer can upload');
assert(!canUploadFiles('readonly'), 'readonly cannot upload');

assert(isReadOnly('readonly'), 'readonly is read-only');
assert(!isReadOnly('customer'), 'customer is not read-only');

console.log('Auth/RBAC tests passed.');
process.exit(0);
