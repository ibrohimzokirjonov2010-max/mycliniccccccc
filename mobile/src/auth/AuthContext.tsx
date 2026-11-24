import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '@/api/errors';
import { login as loginRequest, logout as logoutRequest, restoreSession, type LoginInput } from '@/api/session';
import type { AuthSnapshot, CrmClinic, CrmUser } from '@/api/types';

type AuthValue = {
  ready: boolean;
  user: CrmUser | null;
  clinic: CrmClinic | null;
  bootError: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    restoreSession()
      .then((next) => {
        if (alive) setSnapshot(next);
      })
      .catch((error: unknown) => {
        if (alive) setBootError(error instanceof ApiError ? error.code : 'generic');
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthValue>(() => ({
    ready,
    user: snapshot?.user ?? null,
    clinic: snapshot?.clinic ?? null,
    bootError,
    login: async (input) => {
      const next = await loginRequest(input);
      setSnapshot(next);
      setBootError(null);
    },
    logout: async () => {
      await logoutRequest();
      setSnapshot(null);
    },
  }), [ready, snapshot, bootError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside provider');
  return value;
}
