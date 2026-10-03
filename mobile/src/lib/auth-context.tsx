import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { loginWithClinic } from '@/lib/auth';
import { clearSession, loadSession, saveSession } from '@/lib/session';
import type { Session } from '@/lib/types';

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  signIn: (clinicId: string, username: string, password: string) => Promise<{ success: true } | { success: false; error: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadSession()
      .then((stored) => {
        if (active) setSession(stored);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (clinicId: string, username: string, password: string) => {
    const result = await loginWithClinic(clinicId, username, password);
    if (!result.success) return result;
    await saveSession(result.session);
    setSession(result.session);
    return { success: true as const };
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, signIn, signOut }),
    [ready, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
