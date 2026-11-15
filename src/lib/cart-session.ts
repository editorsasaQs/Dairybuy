export const SYNCED_CART_USER_KEY = "dairybuy_phase4_2_synced_user_v1";
export const PENDING_CART_USER_KEY = "dairybuy_phase4_2_pending_user_v1";

type CartSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Mark the browser snapshot as belonging to an authenticated user immediately
 * after the server confirms that identity, before any debounced network save.
 * This closes the logout-before-first-save window where another account could
 * otherwise mistake the previous account's local cart for a guest cart.
 */
export function markCartSyncPending(storage: CartSessionStorage, userId: string): void {
  storage.setItem(PENDING_CART_USER_KEY, userId);
}

export function hasCartSessionMarker(storage: CartSessionStorage): boolean {
  return storage.getItem(SYNCED_CART_USER_KEY) !== null ||
    storage.getItem(PENDING_CART_USER_KEY) !== null;
}

export function clearCartSessionMarkers(storage: CartSessionStorage): void {
  storage.removeItem(SYNCED_CART_USER_KEY);
  storage.removeItem(PENDING_CART_USER_KEY);
}
