"use client";
import { useCallback, useSyncExternalStore } from "react";

export type DeviceLocation = {
  status: "idle" | "locating" | "granted" | "denied" | "unavailable";
  coords?: [number, number];
};
// Optional and tab-local. Coordinates are rounded to about 100 m, kept in
// sessionStorage for this tab only, and never sent to Polis. When location is
// declined or unavailable, pages fall back to the campus center.
const key = "polis-device-location";
const idle: DeviceLocation = { status: "idle" };
let current = idle;
let loaded = false;
const listeners = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (Array.isArray(saved?.coords) && saved.coords.length === 2)
      current = { status: "granted", coords: [Number(saved.coords[0]), Number(saved.coords[1])] };
    else if (saved?.status === "denied") current = { status: "denied" };
  } catch {
    /* Storage can be unavailable; location simply starts unknown. */
  }
}
function set(next: DeviceLocation) {
  current = next;
  try {
    if (next.status === "granted" || next.status === "denied")
      sessionStorage.setItem(key, JSON.stringify(next));
    else sessionStorage.removeItem(key);
  } catch {
    /* Keep the in-memory value. */
  }
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const round = (n: number) => Math.round(n * 1000) / 1000;

export function useDeviceLocation() {
  const state = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return current;
    },
    () => idle,
  );
  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      set({ status: "unavailable" });
      return;
    }
    set({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => set({ status: "granted", coords: [round(pos.coords.latitude), round(pos.coords.longitude)] }),
      (error) => set({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);
  const forget = useCallback(() => set(idle), []);
  return { ...state, locate, forget };
}
