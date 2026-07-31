import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ModuleAccessGrant } from '@ibas/shared-types';
import {
  hasLearningModule,
  hasLearningModuleUpdate,
  hasLearningModuleDelete,
  learningGrants,
  setOnUnauthorized,
  type LearningModuleCode,
} from './api';
import {
  clearToken,
  fetchMe,
  loadStoredToken,
  logout as logoutApi,
  type MeUser,
} from './auth-api';
import { unregisterPushNotifications } from './push-notifications';

interface AuthState {
  user: MeUser | null;
  loading: boolean;
  learningModules: ModuleAccessGrant[];
  refreshUser: () => Promise<MeUser>;
  signOut: () => Promise<void>;
  canAccess: (code: LearningModuleCode) => boolean;
  canUpdate: (code: LearningModuleCode) => boolean;
  canDelete: (code: LearningModuleCode) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPushNotifications();
    await logoutApi();
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      void clearToken();
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadStoredToken();
        if (!token) return;
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch (err) {
        // Keep session on network/transient errors; only clear on auth failure (401 handled globally).
        const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
        if (status === 401 || status === 403) {
          await clearToken();
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const learningModules = useMemo(
    () => learningGrants(user?.module_access ?? []),
    [user?.module_access],
  );

  const canAccess = useCallback(
    (code: LearningModuleCode) => hasLearningModule(user?.module_access ?? [], code),
    [user?.module_access],
  );

  const canUpdate = useCallback(
    (code: LearningModuleCode) => hasLearningModuleUpdate(user?.module_access ?? [], code),
    [user?.module_access],
  );

  const canDelete = useCallback(
    (code: LearningModuleCode) => hasLearningModuleDelete(user?.module_access ?? [], code),
    [user?.module_access],
  );

  const value = useMemo(
    () => ({ user, loading, learningModules, refreshUser, signOut, canAccess, canUpdate, canDelete }),
    [user, loading, learningModules, refreshUser, signOut, canAccess, canUpdate, canDelete],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
