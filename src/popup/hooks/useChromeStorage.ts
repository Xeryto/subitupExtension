import { useState, useEffect, useCallback } from 'react';
import { safeStorageGet, safeStorageSet } from '../utils/chrome-api';

export function useChromeStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    safeStorageGet(key, (result) => {
      if (result[key] !== undefined) {
        setValue(result[key]);
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[key]) {
        setValue(changes[key].newValue ?? defaultValue);
      }
    };

    try {
      chrome.storage.local.onChanged.addListener(listener);
    } catch {
      // context invalidated
    }
    return () => {
      try {
        chrome.storage.local.onChanged.removeListener(listener);
      } catch {
        // context invalidated
      }
    };
  }, [key, defaultValue]);

  const set = useCallback((val: T) => {
    setValue(val);
    safeStorageSet({ [key]: val });
  }, [key]);

  return [value, set];
}
