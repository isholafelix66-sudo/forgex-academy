import { useCallback, useMemo, useState } from "react";

const STORAGE_KEY = "forgex-prompt-favorites";

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode etc.) — favorites just won't persist.
  }
}

/** Favorites are stored per-browser (localStorage) so they work for visitors
 *  without an account and stay instant on every device. */
export function usePromptFavorites() {
  const [ids, setIds] = useState<string[]>(load);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      save(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  const value = useMemo(
    () => ({ favorites: ids, toggle, isFavorite }),
    [ids, toggle, isFavorite],
  );
  return value;
}
