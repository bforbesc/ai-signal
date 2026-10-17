export interface ReadingState { readIds: string[] }
type ReadingStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const DEMO_READING_KEY = 'ai-signal-reading-v1:demo';

export function parseReadingState(value: string | null): ReadingState {
  try {
    const data = JSON.parse(value ?? 'null');
    return {
      readIds: Array.isArray(data?.readIds) ? [...new Set<string>(data.readIds.filter((id: unknown) => typeof id === 'string' && id.length > 0))] : [],
    };
  } catch { return { readIds: [] }; }
}

export function loadReadingState(storage: ReadingStorage, key: string): ReadingState {
  try { return parseReadingState(storage.getItem(key)); }
  catch { return { readIds: [] }; }
}

export function saveReadingState(storage: ReadingStorage, key: string, state: ReadingState): boolean {
  try { storage.setItem(key, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function changeReadStatus(state: ReadingState, id: string, read: boolean): ReadingState {
  const ids = new Set(state.readIds);
  if (read) ids.add(id); else ids.delete(id);
  return { ...state, readIds: [...ids] };
}
