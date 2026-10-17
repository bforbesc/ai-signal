import { useEffect, useState } from 'react';
import { changeReadStatus, loadReadingState, DEMO_READING_KEY, saveReadingState, type ReadingState } from '../lib/reading-state';

function load(key: string): ReadingState {
  // Access to localStorage itself can be denied by browser privacy settings.
  try { return loadReadingState(window.localStorage, key); }
  catch { return { readIds: [] }; }
}

// Fictional sample progress is local. Real read state always comes from Gmail.
export function useReadingState() {
  const key = DEMO_READING_KEY;
  const [stored, setStored] = useState(() => ({ key, value: load(key) }));
  const [storageWarning, setStorageWarning] = useState(false);
  const current = stored.key === key ? stored.value : load(key);

  useEffect(() => {
    setStored({ key, value: load(key) });
    setStorageWarning(false);
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setStored({ key, value: load(key) });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  function update(value: ReadingState) {
    setStored({ key, value });
    try { setStorageWarning(!saveReadingState(window.localStorage, key, value)); }
    catch { setStorageWarning(true); }
  }

  return {
    isRead: (id: string) => current.readIds.includes(id),
    setRead: (id: string, read: boolean) => update(changeReadStatus(current, id, read)),
    storageWarning,
  };
}
