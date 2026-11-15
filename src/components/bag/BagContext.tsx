"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  isAddableBagItem,
  mergeBagItems,
  sanitizeStoredBagItems,
  type AddBagItemInput,
  type BagItem,
} from "@/lib/bag";
import {
  clearCartSessionMarkers,
  hasCartSessionMarker,
  markCartSyncPending,
  PENDING_CART_USER_KEY,
  SYNCED_CART_USER_KEY,
} from "@/lib/cart-session";

export type { AddBagItemInput, BagItem, BagItemKind } from "@/lib/bag";

type BagContextValue = {
  items: readonly BagItem[];
  totalCount: number;
  isOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  addItem: (input: AddBagItemInput) => void;
  incrementItem: (key: string) => void;
  decrementItem: (key: string) => void;
  removeItem: (key: string) => void;
  clearBag: () => void;
  getQuantity: (key: string) => number;
};

const STORAGE_KEY = "dairybuy_phase3_bag_v1";
const EMPTY_ITEMS: readonly BagItem[] = [];

let memoryItems: readonly BagItem[] = EMPTY_ITEMS;
let initializedFromStorage = false;
const listeners = new Set<() => void>();

function readInitialStorage(): readonly BagItem[] {
  if (typeof window === "undefined") {
    return EMPTY_ITEMS;
  }
  if (!initializedFromStorage) {
    initializedFromStorage = true;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        memoryItems = sanitizeStoredBagItems(parsed);
      }
    } catch {
      memoryItems = EMPTY_ITEMS;
    }
  }
  return memoryItems;
}

function writeItems(next: readonly BagItem[]) {
  memoryItems = next;
  initializedFromStorage = true;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors in restricted browsing modes
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly BagItem[] {
  return readInitialStorage();
}

function getServerSnapshot(): readonly BagItem[] {
  return EMPTY_ITEMS;
}

const BagContext = createContext<BagContextValue | null>(null);

export function BagProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [remoteState, setRemoteState] = useState<{ ready: boolean; userId: string | null }>({
    ready: false,
    userId: null,
  });
  const remoteStateRef = useRef<{ ready: boolean; userId: string | null }>({
    ready: false,
    userId: null,
  });

  // The server cookie session is authoritative. A 401 means guest mode; a
  // successful GET hydrates the account cart and performs a one-time guest merge.
  useEffect(() => {
    let cancelled = false;
    // A route transition can be a sign-in/sign-out redirect. Pause writes
    // until the server cookie session has been re-checked for this route.
    remoteStateRef.current = { ready: false, userId: null };

    async function hydrateAccountCart() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) {
          const hadAccountMarker = hasCartSessionMarker(window.sessionStorage);
          clearCartSessionMarkers(window.sessionStorage);
          if (hadAccountMarker) writeItems(EMPTY_ITEMS);
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
          return;
        }
        if (!response.ok) {
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
          return;
        }

        const payload: unknown = await response.json();
        if (cancelled) return;
        if (!payload || typeof payload !== "object" || !("data" in payload)) {
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
          return;
        }
        const data = payload.data;
        if (!data || typeof data !== "object" ||
            !("userId" in data) || typeof data.userId !== "string" ||
            !("items" in data) || !Array.isArray(data.items)) {
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
          return;
        }

        const userId = data.userId;
        const remoteItems = data.items as BagItem[];
        const syncedUser = window.sessionStorage.getItem(SYNCED_CART_USER_KEY);
        const pendingUser = window.sessionStorage.getItem(PENDING_CART_USER_KEY);
        let nextItems: readonly BagItem[];

        if (pendingUser === userId) {
          // A failed prior save takes precedence over the last successful marker.
          // Keep the local snapshot and retry it rather than discarding local edits.
          nextItems = readInitialStorage();
        } else if (syncedUser === userId) {
          nextItems = remoteItems;
        } else if (syncedUser || pendingUser) {
          // Never merge one account's cached lines into a different account.
          nextItems = remoteItems;
          window.sessionStorage.removeItem(PENDING_CART_USER_KEY);
          window.sessionStorage.setItem(SYNCED_CART_USER_KEY, userId);
        } else {
          // Establish ownership before enabling the debounced save effect.
          // If logout happens during its 400 ms delay, the next 401 response
          // can still identify and clear this account's local snapshot.
          markCartSyncPending(window.sessionStorage, userId);
          nextItems = mergeBagItems(readInitialStorage(), remoteItems);
        }

        writeItems(nextItems);
        remoteStateRef.current = { ready: true, userId };
        setRemoteState({ ready: true, userId });
      } catch {
        if (!cancelled) {
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
        }
      }
    }

    void hydrateAccountCart();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Debounced full-snapshot sync. The database RPC replaces the cart atomically
  // and derives customer_id from auth.uid(), never from browser input.
  useEffect(() => {
    const currentAuth = remoteStateRef.current;
    if (!remoteState.ready || !remoteState.userId ||
        !currentAuth.ready || currentAuth.userId !== remoteState.userId) return;
    const snapshot = items.map((item) => ({ ...item }));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const currentAuthAtSend = remoteStateRef.current;
      if (!currentAuthAtSend.ready || currentAuthAtSend.userId !== remoteState.userId) return;
      window.sessionStorage.setItem(PENDING_CART_USER_KEY, remoteState.userId as string);
      void fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ items: snapshot }),
      }).then((response) => {
        if (response.ok) {
          window.sessionStorage.setItem(SYNCED_CART_USER_KEY, remoteState.userId as string);
          window.sessionStorage.removeItem(PENDING_CART_USER_KEY);
          return;
        }
        if (response.status === 401) {
          clearCartSessionMarkers(window.sessionStorage);
          writeItems(EMPTY_ITEMS);
          remoteStateRef.current = { ready: true, userId: null };
          setRemoteState({ ready: true, userId: null });
        }
      }).catch(() => {
        // Keep the local snapshot and pending marker; retry after the next change/reload.
      });
    }, 400);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [items, pathname, remoteState.ready, remoteState.userId]);

  const openBag = useCallback(() => setIsOpen(true), []);
  const closeBag = useCallback(() => setIsOpen(false), []);

  const addItem = useCallback((input: AddBagItemInput) => {
    if (!isAddableBagItem(input)) {
      return;
    }
    const step = input.quantity ?? 1;
    const current = readInitialStorage();
    const existingIndex = current.findIndex((item) => item.key === input.key);
    if (existingIndex >= 0) {
      const next = current.map((item, idx) =>
        idx === existingIndex
          ? { ...item, quantity: Math.min(100, item.quantity + step) }
          : item,
      );
      writeItems(next);
    } else {
      const { quantity: _ignored, ...rest } = input;
      void _ignored;
      writeItems([...current, { ...rest, quantity: Math.min(100, step) }]);
    }
  }, []);

  const incrementItem = useCallback((key: string) => {
    const current = readInitialStorage();
    writeItems(
      current.map((item) =>
        item.key === key ? { ...item, quantity: Math.min(100, item.quantity + 1) } : item,
      ),
    );
  }, []);

  const decrementItem = useCallback((key: string) => {
    const current = readInitialStorage();
    const next: BagItem[] = [];
    for (const item of current) {
      if (item.key !== key) {
        next.push(item);
      } else if (item.quantity > 1) {
        next.push({ ...item, quantity: item.quantity - 1 });
      }
    }
    writeItems(next);
  }, []);

  const removeItem = useCallback((key: string) => {
    const current = readInitialStorage();
    writeItems(current.filter((item) => item.key !== key));
  }, []);

  const clearBag = useCallback(() => {
    writeItems(EMPTY_ITEMS);
  }, []);

  const getQuantity = useCallback(
    (key: string) => {
      const match = items.find((item) => item.key === key);
      return match ? match.quantity : 0;
    },
    [items],
  );

  const totalCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const value = useMemo<BagContextValue>(
    () => ({
      items,
      totalCount,
      isOpen,
      openBag,
      closeBag,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearBag,
      getQuantity,
    }),
    [
      items,
      totalCount,
      isOpen,
      openBag,
      closeBag,
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearBag,
      getQuantity,
    ],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagContextValue {
  const ctx = useContext(BagContext);
  if (!ctx) {
    throw new Error("useBag must be used inside a BagProvider");
  }
  return ctx;
}
