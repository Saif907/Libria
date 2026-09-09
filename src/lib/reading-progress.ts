/**
 * Reading position, kept in localStorage.
 *
 * Nothing in the bucket records where you stopped, and the UI leans on progress
 * in three places, so this is the honest minimum: real positions from real
 * reading rather than invented percentages. Per-browser by nature — swapping it
 * for a Supabase table later only means reimplementing read/write below.
 */

import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "libria:reading-progress:v1";

export type ReadingProgress = {
  chapterIndex: number;
  totalChapters: number;
  /** Epoch milliseconds. */
  updatedAt: number;
};

export type ProgressMap = Record<string, ReadingProgress>;

/** Notifies same-tab listeners; the `storage` event only fires cross-tab. */
const CHANGE_EVENT = "libria:reading-progress-change";

function isProgress(value: unknown): value is ReadingProgress {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReadingProgress>;
  return (
    typeof candidate.chapterIndex === "number" &&
    typeof candidate.totalChapters === "number" &&
    typeof candidate.updatedAt === "number" &&
    candidate.totalChapters > 0
  );
}

export function readAllProgress(): ProgressMap {
  // Storage is unavailable during SSR, and throws outright in some privacy
  // modes — an empty map is always a valid answer.
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const result: ProgressMap = {};
    for (const [bookId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isProgress(value)) result[bookId] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function writeProgress(bookId: string, chapterIndex: number, totalChapters: number): void {
  if (typeof localStorage === "undefined" || totalChapters <= 0) return;
  try {
    const next: ProgressMap = {
      ...readAllProgress(),
      [bookId]: { chapterIndex, totalChapters, updatedAt: Date.now() },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // A failed write costs the reader their position, not their session.
  }
}

/** 0 for an unopened book; 1 once the final chapter has been opened. */
export function progressFraction(progress: ReadingProgress | undefined): number {
  if (!progress) return 0;
  return Math.min(1, (progress.chapterIndex + 1) / progress.totalChapters);
}

export function lastOpenedLabel(progress: ReadingProgress | undefined): string {
  if (!progress) return "Not opened yet";
  return formatDistanceToNow(progress.updatedAt, { addSuffix: true });
}

/* ---------- Hooks ---------- */

type Store = { progress: ProgressMap; hydrated: boolean };

function useProgressStore(): Store {
  // Starts empty so the server and the first client render agree; the effect
  // fills it in immediately after hydration. `hydrated` lets a page tell
  // "nothing saved" apart from "not read from storage yet".
  const [store, setStore] = useState<Store>({ progress: {}, hydrated: false });

  useEffect(() => {
    const sync = () => setStore({ progress: readAllProgress(), hydrated: true });
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return store;
}

export function useAllProgress(): Store {
  return useProgressStore();
}

export function useProgress(bookId: string): {
  progress: ReadingProgress | undefined;
  fraction: number;
  save: (chapterIndex: number, totalChapters: number) => void;
} {
  const { progress: store } = useProgressStore();
  const progress = store[bookId];

  const save = useCallback(
    (chapterIndex: number, totalChapters: number) =>
      writeProgress(bookId, chapterIndex, totalChapters),
    [bookId],
  );

  return { progress, fraction: progressFraction(progress), save };
}
