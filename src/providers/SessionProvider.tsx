'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { SessionTimeoutWarning } from '@/components/organisms/SessionTimeoutWarning';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
      <SessionTimeoutWarning />
    </NextAuthSessionProvider>
  );
}
