import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Lock to landscape while `active` (e.g. Differences model answer visible).
 * Restores portrait when inactive / unmounted.
 */
export function useDifferencesLandscape(active: boolean) {
  useEffect(() => {
    let cancelled = false;

    async function apply() {
      try {
        if (active) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        /* orientation lock may be unavailable on web/simulator */
      }
    }

    void apply();

    return () => {
      cancelled = true;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {
        /* ignore */
      });
      void cancelled;
    };
  }, [active]);
}
