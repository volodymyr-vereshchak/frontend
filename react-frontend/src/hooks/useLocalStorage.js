import { useState, useEffect } from 'react';

// Legacy enterprise-cache entries (the localStorage cache was removed —
// the server archive is the single source now). Dropped to free quota.
const LEGACY_PREFIXES = ['ent4_', 'ent3_', 'ent2_', 'ent_'];

function dropLegacyCacheEntries() {
  for (const k of Object.keys(localStorage)) {
    if (LEGACY_PREFIXES.some(p => k.startsWith(p))) localStorage.removeItem(k);
  }
}

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
      dropLegacyCacheEntries();
      try {
        localStorage.setItem(key, serialized);
      } catch {
        console.warn(`[useLocalStorage] Failed to persist "${key}" — quota exhausted`);
      }
    }
  }, [key, value]);

  return [value, setValue];
}
