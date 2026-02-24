import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAX_BODY_BYTES = Number(process.env.MAX_REQUEST_BODY_BYTES) || 65536;
const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth/login', '/api/auth/signup', '/api/auth/csrf', '/api/auth/status'];
const ADMIN_PREFIX = '/admin';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith('/api/auth/'));
  const isApi = path.startsWith('/api/');

  if (request.method === 'POST' && isApi) {
    const isFileUpload = path === '/api/files/upload';
    if (!isFileUpload) {
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
        return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
