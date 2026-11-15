import { describe, expect, it } from "vitest";
import {
  clearCartSessionMarkers,
  hasCartSessionMarker,
  markCartSyncPending,
  PENDING_CART_USER_KEY,
  SYNCED_CART_USER_KEY,
} from "./cart-session";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => { values.delete(key); },
    snapshot: () => new Map(values),
  };
}

describe("cart session ownership markers", () => {
  it("marks the authenticated owner before the debounced save can run", () => {
    const storage = createStorage();

    markCartSyncPending(storage, "customer-a");

    expect(storage.getItem(PENDING_CART_USER_KEY)).toBe("customer-a");
    expect(hasCartSessionMarker(storage)).toBe(true);
  });

  it("lets logout detect an account cart even before the first save completes", () => {
    const storage = createStorage();

    // Simulate account hydration, followed by logout inside the 400 ms debounce.
    markCartSyncPending(storage, "customer-a");

    expect(hasCartSessionMarker(storage)).toBe(true);
    clearCartSessionMarkers(storage);
    expect(hasCartSessionMarker(storage)).toBe(false);
    expect(storage.getItem(PENDING_CART_USER_KEY)).toBeNull();
    expect(storage.getItem(SYNCED_CART_USER_KEY)).toBeNull();
  });

  it("does not leave a previous account marker after switching accounts", () => {
    const storage = createStorage();
    storage.setItem(SYNCED_CART_USER_KEY, "customer-a");

    clearCartSessionMarkers(storage);
    markCartSyncPending(storage, "customer-b");

    expect(storage.getItem(SYNCED_CART_USER_KEY)).toBeNull();
    expect(storage.getItem(PENDING_CART_USER_KEY)).toBe("customer-b");
  });
});
