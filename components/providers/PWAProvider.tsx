"use client";

import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";

interface SyncStatus {
  syncInProgress: boolean;
  pendingOperations: number;
  lastSync: string | null;
}

interface PWAContextValue {
  isOffline: boolean;
  isInstalled: boolean;
  syncStatus: SyncStatus;
  triggerSync: () => Promise<void>;
}

const PWAContext = createContext<PWAContextValue>({
  isOffline: false,
  isInstalled: false,
  syncStatus: { syncInProgress: false, pendingOperations: 0, lastSync: null },
  triggerSync: async () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

export default function PWAProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncInProgress: false,
    pendingOperations: 0,
    lastSync: null,
  });

  const updateOnlineStatus = useCallback(() => {
    setIsOffline(!navigator.onLine);
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncStatus((prev) => ({ ...prev, syncInProgress: true }));
    try {
      const { manualSync } = await import("@/lib/offline/sync.engine");
      await manualSync();
      setSyncStatus({ syncInProgress: false, pendingOperations: 0, lastSync: new Date().toISOString() });
    } catch {
      setSyncStatus((prev) => ({ ...prev, syncInProgress: false }));
    }
  }, []);

  useEffect(() => {
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { registerOfflineSW } = await import("@/features/offline/services/sw.registration");
        await registerOfflineSW();
      } catch {
        // SW registration failure is non-critical
      }
    })();
  }, []);

  useEffect(() => {
    if (isOffline) { return; }
    (async () => {
      try {
        const { initializeOfflineSync } = await import("@/lib/offline/sync.engine");
        await initializeOfflineSync();
      } catch {
        // Sync init failure is non-critical on first load
      }
    })();
  }, [isOffline]);

  return (
    <PWAContext.Provider value={{ isOffline, isInstalled, syncStatus, triggerSync }}>
      {children}
    </PWAContext.Provider>
  );
}
