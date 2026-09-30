import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import type { AccessRequiredVariant } from '@/components/home/AccessRequiredScreen';
import { findModuleStop, hasLearningModule, isFreeLearningModule, isModuleEffectivelyStopped } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { GatedModule } from '@/lib/home-modules';

export interface AccessScreenState {
  variant: AccessRequiredVariant;
  moduleTitle?: string;
  stoppedReason?: string;
}

/** Opens a gated learning module, or explains why it can't be opened (stopped, unpaid, denied, offline). */
export function useModuleOpener() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [checkingModuleId, setCheckingModuleId] = useState<string | null>(null);
  const [accessScreen, setAccessScreen] = useState<AccessScreenState | null>(null);

  const openModule = useCallback(
    async (module: GatedModule) => {
      if (isModuleEffectivelyStopped(user?.module_stops ?? [], user?.module_access ?? [], module.code)) {
        const stop = findModuleStop(user?.module_stops ?? [], module.code);
        setAccessScreen({ variant: 'stopped', moduleTitle: module.title, stoppedReason: stop?.stopped_reason });
        return;
      }

      if (isFreeLearningModule(module.code)) {
        router.push(module.href);
        return;
      }

      if (user && user.has_paid === false) {
        setAccessScreen({ variant: 'unpaid', moduleTitle: module.title });
        return;
      }

      if (hasLearningModule(user?.module_access ?? [], module.code)) {
        router.push(module.href);
        return;
      }

      setCheckingModuleId(module.id);
      try {
        const me = await refreshUser();
        if (isModuleEffectivelyStopped(me.module_stops ?? [], me.module_access ?? [], module.code)) {
          const freshStop = findModuleStop(me.module_stops ?? [], module.code);
          setAccessScreen({ variant: 'stopped', moduleTitle: module.title, stoppedReason: freshStop?.stopped_reason });
          return;
        }
        if (me.has_paid === false) {
          setAccessScreen({ variant: 'unpaid', moduleTitle: module.title });
          return;
        }
        if (hasLearningModule(me.module_access ?? [], module.code)) {
          router.push(module.href);
          return;
        }
        setAccessScreen({ variant: 'denied', moduleTitle: module.title });
      } catch {
        setAccessScreen({ variant: 'network-error' });
      } finally {
        setCheckingModuleId(null);
      }
    },
    [refreshUser, router, user],
  );

  return { openModule, checkingModuleId, accessScreen, closeAccessScreen: () => setAccessScreen(null) };
}
