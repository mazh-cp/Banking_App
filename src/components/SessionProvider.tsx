'use client';

import { type ReactNode } from 'react';

/**
 * Session provider wrapper. This app uses server-side getSession() and cookies;
 * this component exists to satisfy layout structure and can be extended for client session state if needed.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
