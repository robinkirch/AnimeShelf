"use client";

import { useCallback, useEffect, useState } from 'react';
import type { UpdateStatus } from '@/types/update';

/** App version and auto-update state from the Electron main process (electron/updater.ts). */
export function useUpdateStatus() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: 'disabled' });

  useEffect(() => {
    const store = window.electronStore;
    if (!store) return;
    let active = true;
    store.getAppVersion().then(v => { if (active) setVersion(v); }).catch(() => {});
    store.getUpdateStatus().then(s => { if (active) setStatus(s); }).catch(() => {});
    const unsubscribe = store.onUpdateStatus(setStatus);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const check = useCallback(async () => {
    const store = window.electronStore;
    if (store) setStatus(await store.checkForUpdates());
  }, []);

  const install = useCallback(() => window.electronStore?.installUpdate(), []);

  return { version, status, check, install };
}
