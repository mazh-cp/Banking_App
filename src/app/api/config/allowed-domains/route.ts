import { NextResponse } from 'next/server';

/**
 * Returns allowlisted domains for link safety (e.g. for chat message rendering).
 * Used by the client to decide whether to render URLs as clickable or as "Unverified link".
 */
export async function GET() {
  const raw = process.env.LAKERA_ALLOWED_DOMAINS ?? '';
  const allowedDomains = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return NextResponse.json({ allowedDomains });
}
