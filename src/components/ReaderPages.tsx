import { useCallback, useEffect, useRef, useState } from 'react';
import { readSwipeMessage, type SwipeDirection } from '../lib/reader-navigation';

interface Page { key: number; id: string; title: string; html: string }
interface PendingPage { page: Page; direction: SwipeDirection | null; ready: boolean }

// Keep the current document painted until its replacement is ready, then slide both pages.
export function ReaderPages({ id, title, html, channel, direction, onSwipe, onSettled }: {
  id: string; title: string; html: string; channel: string; direction: SwipeDirection;
  onSwipe: (direction: SwipeDirection) => void; onSettled: () => void;
}) {
  const serial = useRef(0);
  const [current, setCurrent] = useState<Page>(() => ({ key: 0, id, title, html }));
  const [pending, setPending] = useState<PendingPage | null>(null);
  const activeFrame = useRef<HTMLIFrameElement | null>(null);
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const latest = useRef({ onSwipe, onSettled }); latest.current = { onSwipe, onSettled };
  const animationFrames = useRef<number[]>([]);

  useEffect(() => {
    if (current.id === id && current.html === html) {
      if (pendingRef.current) { pendingRef.current = null; setPending(null); latest.current.onSettled(); }
      return;
    }
    setPending({ page: { key: ++serial.current, id, title, html }, direction: current.id === id ? null : direction, ready: false });
    // Only a new document should stage a page; promotion keeps the already-loaded iframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, html, title]);

  const finish = useCallback((key: number) => {
    const next = pendingRef.current;
    if (!next || next.page.key !== key) return;
    pendingRef.current = null;
    setCurrent(next.page); setPending(null); latest.current.onSettled();
  }, []);

  function ready(key: number) {
    const next = pendingRef.current;
    if (!next || next.page.key !== key) return;
    if (!next.direction || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(key); return; }
    // Let the new document paint off-screen before moving it into view.
    animationFrames.current.push(requestAnimationFrame(() => {
      animationFrames.current.push(requestAnimationFrame(() => setPending(value => value?.page.key === key ? { ...value, ready: true } : value)));
    }));
  }

  useEffect(() => () => { animationFrames.current.forEach(cancelAnimationFrame); animationFrames.current = []; }, [pending?.page.key]);
  useEffect(() => {
    if (!pending?.ready) return;
    const timeout = window.setTimeout(() => finish(pending.page.key), 420);
    return () => window.clearTimeout(timeout);
  }, [pending?.ready, pending?.page.key, finish]);
  useEffect(() => {
    const swipe = (event: MessageEvent) => {
      if (pendingRef.current) return;
      const requested = readSwipeMessage(event, activeFrame.current?.contentWindow ?? null, channel);
      if (requested) latest.current.onSwipe(requested);
    };
    window.addEventListener('message', swipe);
    return () => window.removeEventListener('message', swipe);
  }, [channel]);

  const pages = pending ? [current, pending.page] : [current];
  return <div className={`reader-pages ${pending?.ready ? 'is-moving' : ''}`} data-direction={pending?.direction ?? direction} aria-busy={!!pending}>
    {pages.map(page => {
      const incoming = page.key === pending?.page.key;
      const accessible = pending?.ready ? incoming : !incoming;
      return <div key={page.key} className={`reader-page ${incoming ? 'page-incoming' : 'page-current'}`} aria-hidden={!accessible} inert={!accessible}
        onTransitionEnd={event => { if (incoming && event.target === event.currentTarget && event.propertyName === 'transform') finish(page.key); }}>
        <iframe ref={element => { if (!incoming) activeFrame.current = element; }} title={`Full newsletter: ${page.title}`} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={page.html} onLoad={() => { if (incoming) ready(page.key); }}/>
      </div>;
    })}
  </div>;
}
