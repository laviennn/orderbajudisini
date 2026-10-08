"use client";
import { useSyncExternalStore } from "react";
const key = "orderbajudisini.cart.v1";
const empty: readonly string[] = [];
let ids: readonly string[] = empty;
let loaded = false;
let persistence = true;
const listeners = new Set<() => void>();
export function parseCartStorage(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value
              .filter(
                (v): v is string =>
                  typeof v === "string" &&
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    v,
                  ),
              )
              .map((id) => id.toLowerCase()),
          ),
        ].slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
function notify() {
  listeners.forEach((fn) => fn());
}
function load() {
  try {
    ids = parseCartStorage(localStorage.getItem(key));
  } catch {
    persistence = false;
  }
  loaded = true;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!loaded) {
    load();
    notify();
  }
  const sync = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      ids = parseCartStorage(event.newValue);
      notify();
    }
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", sync);
  };
}
export function setCart(next: readonly string[]) {
  ids = [...new Set(next)].slice(0, 100);
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    persistence = false;
  }
  notify();
}
export function useCart() {
  const items = useSyncExternalStore(
    subscribe,
    () => ids,
    () => empty,
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
  return {
    ids: items,
    ready,
    persistent: persistence,
    add: (id: string) => setCart([...ids, id]),
    remove: (id: string) => setCart(ids.filter((p) => p !== id)),
    clear: () => setCart([]),
    removeOrdered: (ordered: readonly string[]) =>
      setCart(ids.filter((id) => !ordered.includes(id))),
  };
}
