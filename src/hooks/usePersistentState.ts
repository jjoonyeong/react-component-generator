import { useEffect, useState } from 'react';

export function usePersistentState<T>(key: string, initial: T, decode: (value: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : decode(JSON.parse(stored));
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* Keep the current session usable when storage is unavailable. */ }
  }, [key, value]);
  return [value, setValue] as const;
}
