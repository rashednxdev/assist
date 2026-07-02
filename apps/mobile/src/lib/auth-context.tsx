import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ModuleAccessGrant } from '@ibas/shared-types';
import { hasLearningModule, learningGrants, type LearningModuleCode } from './api';
import {
  fetchMe,
  loadStoredToken,
  logout as logoutApi,
  type MeUser,
} from './auth-api';

interface AuthState {
  user: MeUser | null;
  loading: boolean;
  learningModules: ModuleAccessGrant[];
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  canAccess: (code: LearningModuleCode) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadStoredToken();
        if (!token) return;
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  const learningModules = useMemo(
    () => learningGrants(user?.module_access ?? []),
    [user?.module_access],
  );

  const canAccess = useCallback(
    (code: LearningModuleCode) => hasLearningModule(user?.module_access ?? [], code),
    [user?.module_access],
  );

  const value = useMemo(
    () => ({ user, loading, learningModules, refreshUser, signOut, canAccess }),
    [user, loading, learningModules, refreshUser, signOut, canAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
