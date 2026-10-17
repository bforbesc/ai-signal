import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/useAuth';
import { fetchPage, findLabel, GmailError, mergeMessages, setMessageRead, type Newsletter, type NewsletterSource } from '../lib/gmail';
import { feedSnapshot, readFeedCache, saveFeedCache, type FeedSnapshot } from '../lib/feed-cache';

export function useFeed() {
  const token = useAuth(state => state.token);
  const email = useAuth(state => state.email);
  const [items, setItems] = useState<Newsletter[]>([]);
  const [sources, setSources] = useState<NewsletterSource[]>([]);
  const [sourceFilter, setSourceFilter] = useState<NewsletterSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [cacheWarning, setCacheWarning] = useState(false);
  const [expired, setExpired] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cursor = useRef<string | undefined>(undefined);
  const label = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const run = useRef(0);
  const loaded = useRef<Newsletter[]>([]);
  const cache = useRef<FeedSnapshot | null>(null);
  const sourceList = useRef<NewsletterSource[]>([]);
  const writes = useRef(new Set<string>());
  const statusSequence = useRef(0);
  const confirmed = useRef(new Map<string, { sequence: number; read: boolean }>());

  useEffect(() => { setSourceFilter(null); }, [email]);

  const load = useCallback(async (refresh = false) => {
    if (!token || !email || busy.current) return;
    if (token.expiresAt < Date.now() + 5000) { setExpired(true); setError('Reconnect Google to load fresh newsletters.'); return; }
    const visit = run.current;
    const sequence = statusSequence.current;
    busy.current = true; setError(''); setExpired(false);
    setLoading(!refresh || loaded.current.length === 0); setRefreshing(refresh);
    const abort = new AbortController(); controller.current = abort;
    try {
      const id = !label.current || refresh ? await findLabel(token.value, abort.signal) : label.current;
      const page = await fetchPage(token.value, id, refresh ? undefined : cursor.current, abort.signal, sourceFilter, cache.current?.items);
      if (abort.signal.aborted || visit !== run.current || useAuth.getState().token !== token) return;
      const fresh = page.items.map(item => {
        const status = confirmed.current.get(item.id);
        if (status && status.sequence <= sequence) confirmed.current.delete(item.id);
        return status && status.sequence > sequence ? { ...item, isRead: status.read } : item;
      });
      loaded.current = mergeMessages(refresh ? [] : loaded.current, fresh);
      setItems(loaded.current);
      label.current = id; cursor.current = page.nextPageToken; setHasMore(!!page.nextPageToken);
      const now = Date.now(); setUpdated(now);
      const catalog = new Map(sourceList.current.map(source => [source.id, source]));
      for (const item of fresh) catalog.set(item.source.id, item.source);
      sourceList.current = [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name));
      setSources(sourceList.current);
      if (!sourceFilter && refresh) cache.current = feedSnapshot(fresh, sourceList.current, page.nextPageToken, now);
      else if (cache.current) {
        const replacements = new Map(fresh.map(item => [item.id, item]));
        cache.current = { ...cache.current, sources: sourceList.current, items: cache.current.items.map(item => replacements.get(item.id) ?? item) };
      }
      if (cache.current) {
        const saved = await saveFeedCache(email, cache.current);
        if (visit === run.current) setCacheWarning(!saved);
      }
    } catch (cause) {
      if (abort.signal.aborted || visit !== run.current) return;
      setError(cause instanceof Error ? cause.message : 'Could not refresh your feed. Please try again.');
      setExpired(cause instanceof GmailError && cause.status === 401);
    } finally {
      if (visit === run.current) { busy.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [token, email, sourceFilter]);

  useEffect(() => {
    const visit = ++run.current;
    controller.current?.abort(); busy.current = false; cursor.current = undefined; label.current = undefined;
    loaded.current = []; writes.current = new Set(); confirmed.current.clear();
    setItems([]); setError(''); setStatusError(''); setUpdatingIds([]); setHasMore(false); setUpdated(null); setLoading(!!token); setRefreshing(false); setExpired(false); setCacheWarning(false);
    if (token && email) void (async () => {
      const saved = await readFeedCache(email);
      if (visit !== run.current || useAuth.getState().token !== token) return;
      cache.current = saved;
      sourceList.current = saved?.sources ?? [];
      setSources(sourceList.current);
      if (saved) {
        loaded.current = saved.items.filter(item => !sourceFilter || item.source.id === sourceFilter.id);
        setItems(loaded.current); setUpdated(saved.updatedAt); setLoading(false);
        cursor.current = sourceFilter ? undefined : saved.nextPageToken;
        setHasMore(sourceFilter ? true : !!saved.nextPageToken);
      }
      void load(true);
    })();
    else { cache.current = null; sourceList.current = []; setSources([]); }
    return () => { run.current++; controller.current?.abort(); busy.current = false; };
  }, [token, email, sourceFilter, load]);

  useEffect(() => {
    if (!token) return;
    const check = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', check); window.addEventListener('online', check); document.addEventListener('visibilitychange', check);
    const interval = window.setInterval(check, 10 * 60000);
    return () => { window.removeEventListener('focus', check); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); window.clearInterval(interval); };
  }, [token, load]);

  async function setRead(id: string, read: boolean) {
    if (!token || !email || writes.current.has(id)) return;
    if (!token.canMarkRead) { setStatusError('Reconnect Gmail to enable read/unread sync.'); return; }
    const visit = run.current;
    writes.current.add(id); setUpdatingIds([...writes.current]); setStatusError('');
    try {
      const allowed = label.current ?? await findLabel(token.value);
      const savedRead = await setMessageRead(token.value, id, read, allowed);
      if (visit !== run.current || useAuth.getState().token !== token) return;
      confirmed.current.set(id, { sequence: ++statusSequence.current, read: savedRead });
      loaded.current = loaded.current.map(item => item.id === id ? { ...item, isRead: savedRead } : item);
      setItems(loaded.current);
      if (cache.current) {
        cache.current = { ...cache.current, items: cache.current.items.map(item => item.id === id ? { ...item, isRead: savedRead } : item) };
        const saved = await saveFeedCache(email, cache.current);
        if (visit === run.current) setCacheWarning(!saved);
      }
    } catch (cause) {
      if (visit !== run.current) return;
      setStatusError(cause instanceof Error ? cause.message : 'Read status could not be saved. Please try again.');
      if (cause instanceof GmailError && [401, 403, 428].includes(cause.status)) setExpired(true);
    } finally {
      if (visit === run.current) { writes.current.delete(id); setUpdatingIds([...writes.current]); }
    }
  }
  return { items, sources, sourceFilter, setSourceFilter, sourceError: '', loading, refreshing, error, statusError, updatingIds, cacheWarning, expired, hasMore, updated, load, setRead, isRead: (item: Newsletter) => confirmed.current.get(item.id)?.read ?? item.isRead, refresh: () => load(true) };
}
