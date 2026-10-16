import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/useAuth';
import { discoverSources, fetchPage, findLabel, GmailError, mergeMessages, type Newsletter, type NewsletterSource } from '../lib/gmail';
export function useFeed() {
  const token = useAuth(state => state.token);
  const [items, setItems] = useState<Newsletter[]>([]);
  const [sources, setSources] = useState<NewsletterSource[]>([]);
  const [sourceFilter, setSourceFilter] = useState<NewsletterSource | null>(null);
  const [sourceError, setSourceError] = useState('');
  const [discoveryVersion, setDiscoveryVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const cursor = useRef<string | undefined>(undefined); const label = useRef<string | undefined>(undefined); const busy = useRef(false);
  useEffect(() => { setSources([]); setSourceFilter(null); setSourceError(''); }, [token]);
  useEffect(() => {
    if (!token) return;
    const abort = new AbortController(); setSourceError('');
    void (async () => {
      try { const id = await findLabel(token.value, abort.signal); await discoverSources(token.value, id, setSources, abort.signal); }
      catch { if (!abort.signal.aborted) setSourceError('The newsletter list could not finish loading. Refresh to try again.'); }
    })();
    return () => abort.abort();
  }, [token, discoveryVersion]);
  const load = useCallback(async (refresh = false) => {
    if (!token || busy.current) return;
    if (token.expiresAt < Date.now() + 5000) { setExpired(true); setError('Reconnect Google to load fresh newsletters.'); return; }
    busy.current = true; setLoading(true); setError(''); setExpired(false);
    const abort = new AbortController(); controller.current = abort;
    try {
      const id = !label.current || refresh ? await findLabel(token.value, abort.signal) : label.current;
      const page = await fetchPage(token.value, id, refresh ? undefined : cursor.current, abort.signal, sourceFilter);
      if (abort.signal.aborted) return;
      setItems(previous => mergeMessages(refresh ? [] : previous, page.items));
      label.current = id; cursor.current = page.nextPageToken; setHasMore(!!page.nextPageToken); setUpdated(Date.now());
      setSources(previous => {
        const map = new Map(previous.map(source => [source.id, source]));
        for (const item of page.items) map.set(item.source.id, item.source);
        return [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
      });
    } catch (error) {
      if (abort.signal.aborted) return;
      setError(error instanceof Error ? error.message : 'Could not load your feed. Please try again.');
      setExpired(error instanceof GmailError && error.status === 401);
    } finally { if (!abort.signal.aborted) { busy.current = false; setLoading(false); } }
  }, [token, sourceFilter]);
  useEffect(() => {
    controller.current?.abort(); busy.current = false; cursor.current = undefined; label.current = undefined;
    setItems([]); setError(''); setHasMore(false); setUpdated(null); setLoading(false); setExpired(false);
    if (token) void load(true);
    return () => { controller.current?.abort(); busy.current = false; };
  }, [token, sourceFilter, load]);
  async function refresh() { setDiscoveryVersion(value => value + 1); await load(true); }
  return { items, sources, sourceFilter, setSourceFilter, sourceError, loading, error, expired, hasMore, updated, load, refresh };
}
