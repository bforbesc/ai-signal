import { create } from 'zustand';

function saved(key: string): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); }
  catch { return null; }
}
function remember(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

interface ReadingPreferences {
  font: number; original: boolean; images: boolean; storageUnavailable: boolean;
  resize: (font: number) => void;
  chooseLayout: (original: boolean) => void;
  toggleImages: () => void;
}

// One store keeps the feed and reader controls in sync, preserving existing device defaults.
export const useReadingPreferences = create<ReadingPreferences>((set, get) => ({
  font: Math.min(24, Math.max(16, Number(saved('ai-signal-font')) || 19)),
  original: saved('ai-signal-layout') === 'email',
  images: saved('ai-signal-images') === 'true',
  storageUnavailable: false,
  resize(font) { const value = Math.min(24, Math.max(16, font)); const saved = remember('ai-signal-font', String(value)); set({ font: value, storageUnavailable: get().storageUnavailable || !saved }); },
  chooseLayout(original) { const saved = remember('ai-signal-layout', original ? 'email' : 'reading'); set({ original, storageUnavailable: get().storageUnavailable || !saved }); },
  toggleImages() { const images = !get().images; const saved = remember('ai-signal-images', String(images)); set({ images, storageUnavailable: get().storageUnavailable || !saved }); },
}));
