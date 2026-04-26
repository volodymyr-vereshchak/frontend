import { useState, useEffect } from 'react';
import { enforceCacheBudget } from '../services/enterpriseCache';

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    const serialized = JSON.stringify(value);
    try {
      localStorage.setItem(key, serialized);
    } catch {
      enforceCacheBudget(1 * 1024 * 1024);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        console.warn(`[useLocalStorage] Failed to persist "${key}" — quota exhausted`);
      }
    }
  }, [key, value]);

  return [value, setValue];
}
