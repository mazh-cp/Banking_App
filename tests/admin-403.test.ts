/**
 * Admin 403 test: non-admin must not access GET /api/admin/settings.
 * Run against running server: curl with a non-admin session cookie should get 403.
 * This file documents the expected behavior; for automated test we'd need a test harness.
 *
 * Manual check:
 * 1. Log in as alice@example.com (customer) -> get session cookie
 * 2. curl -b "finguard.session=<cookie>" http://localhost:5000/api/admin/settings
 * 3. Expect 403 Forbidden
 *
 * With admin cookie expect 200 and JSON with openai.isSet, etc. (no plaintext keys).
 */

console.log('Admin 403 test: manual verification.');
console.log('  As non-admin: GET /api/admin/settings -> 403');
console.log('  As admin: GET /api/admin/settings -> 200, response must not contain plaintext API keys.');
console.log('  Response may only contain: isSet, masked (e.g. sk-…****), updatedAt, updatedBy.');
process.exit(0);
