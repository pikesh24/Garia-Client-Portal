import { useSyncExternalStore } from "react";

const STORAGE_KEY = "garia_unread_fr_messages";

type Listener = () => void;

const listeners = new Set<Listener>();
let cachedSnapshot: number[] = readFromStorage();

function readFromStorage(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(ids: number[]) {
  cachedSnapshot = ids;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (private mode, blocked site data, etc.) -- unread
    // state just won't survive a reload, which degrades gracefully.
  }
  listeners.forEach((l) => l());
}

export function markFeatureRequestUnread(featureRequestId: number) {
  if (!cachedSnapshot.includes(featureRequestId)) {
    persist([...cachedSnapshot, featureRequestId]);
  }
}

export function markFeatureRequestRead(featureRequestId: number) {
  if (cachedSnapshot.includes(featureRequestId)) {
    persist(cachedSnapshot.filter((id) => id !== featureRequestId));
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number[] {
  return cachedSnapshot;
}

function getServerSnapshot(): number[] {
  return [];
}

export function useUnreadFeatureRequestIds(): number[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
