import { mergeMessages, type Newsletter, type NewsletterSource } from './gmail.ts';

export const CACHE_LIMIT = 30;
export interface FeedSnapshot { items: Newsletter[]; sources: NewsletterSource[]; nextPageToken?: string; updatedAt: number }
const databaseName = 'ai-signal-feed-v1';
const accountKey = (account: string) => account.trim().toLowerCase();

export function feedSnapshot(items: Newsletter[], sources: NewsletterSource[], nextPageToken?: string, updatedAt = Date.now()): FeedSnapshot {
  return { items: mergeMessages([], items).slice(0, CACHE_LIMIT), sources, nextPageToken, updatedAt };
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let expired = false;
    const timeout = setTimeout(() => { expired = true; reject(new Error('Device cache unavailable')); }, 2000);
    request.onupgradeneeded = () => { request.result.createObjectStore('feeds'); };
    request.onerror = () => { clearTimeout(timeout); reject(request.error); };
    request.onsuccess = () => { clearTimeout(timeout); if (expired) request.result.close(); else resolve(request.result); };
  });
}

async function operation<T>(account: string, mode: IDBTransactionMode, run: (store: IDBObjectStore, key: string) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('feeds', mode);
      const request = run(transaction.objectStore('feeds'), accountKey(account));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function readFeedCache(account: string): Promise<FeedSnapshot | null> {
  try {
    const value = await operation<FeedSnapshot | undefined>(account, 'readonly', (store, key) => store.get(key));
    if (!value || !Array.isArray(value.items) || !Array.isArray(value.sources) || !Number.isFinite(value.updatedAt)) return null;
    if (!value.items.every(item => item && typeof item.id === 'string' && typeof item.html === 'string' && typeof item.text === 'string' && typeof item.subject === 'string' && typeof item.sender === 'string' && typeof item.snippet === 'string' && typeof item.isRead === 'boolean' && Number.isFinite(item.date) && Number.isFinite(item.readMinutes) && item.source && typeof item.source.id === 'string')) return null;
    if (!value.sources.every(source => source && typeof source.id === 'string' && typeof source.name === 'string')) return null;
    return feedSnapshot(value.items, value.sources, value.nextPageToken, value.updatedAt);
  } catch { return null; }
}

export async function saveFeedCache(account: string, snapshot: FeedSnapshot): Promise<boolean> {
  try { await operation(account, 'readwrite', (store, key) => store.put(snapshot, key)); return true; }
  catch { return false; }
}

export async function clearFeedCache(account: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return true;
  try { await operation(account, 'readwrite', (store, key) => store.delete(key)); return true; }
  catch { return false; }
}
