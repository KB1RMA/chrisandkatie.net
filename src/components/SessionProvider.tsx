'use client';

/**
 * Client-side SessionProvider wrapper for Auth.js.
 *
 * Wraps the application to provide session context to all components.
 * Must be a client component to use React Context.
 */
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Props for the SessionProvider component.
 */
type SessionProviderProps = {
  children: ReactNode;
};

/**
 * Wraps children with Auth.js SessionProvider.
 *
 * @param props - Component props
 * @param props.children - Child components to wrap
 * @returns Wrapped children with session context
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
