import { useEffect, useMemo, useRef, useState } from 'react';
import { SignIn } from './components/SignIn';
import { Setup } from './components/Setup';
import { ReadingSettings } from './components/ReadingSettings';
import { ReaderPages } from './components/ReaderPages';
import { useReadingPreferences } from './store/useReadingPreferences';
import { navigateSwipe, type SwipeDirection } from './lib/reader-navigation';
import { useAuth } from './store/useAuth';
import { getClientId, prepareGoogle } from './lib/auth';
import { DEMO } from './lib/demo';
import { previewText, readerDocument } from './lib/reader';
import { useFeed } from './hooks/useFeed';
import { useReadingState } from './hooks/useReadingState';
import type { Newsletter } from './lib/gmail';

function SignalMark() {
  return <svg width="25" height="25" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 15h5l3-8 5 15 4-13 2 6h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function RefreshIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11a8 8 0 10-1.8 6M20 4v7h-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function dateLabel(date: number) {
  const day = new Date(date); const today = new Date();
  if (day.toDateString() === today.toDateString()) return 'Today';
  return day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function Reader({ item, onClose, onNext, onPrevious, position, statusError, isRead = false, onToggleRead, savingRead = false }: { item: Newsletter; onClose: () => void; onNext?: () => void; onPrevious?: () => void; position: string; statusError?: string; isRead?: boolean; onToggleRead?: () => void; savingRead?: boolean }) {
  const { font, original, images } = useReadingPreferences();
  const [gestureChannel] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''));
  const doc = useMemo(() => readerDocument(item, original, images, font, gestureChannel), [item, original, images, font, gestureChannel]);
  const readerRef = useRef<HTMLElement>(null);
  const [direction, setDirection] = useState<SwipeDirection>('next');
  const [moving, setMoving] = useState(false);
  const locked = useRef(false);
  function navigate(requested: SwipeDirection) {
    if (locked.current || !(requested === 'next' ? onNext : onPrevious)) return;
    locked.current = true; setMoving(true); setDirection(requested);
    navigateSwipe(requested, { onNext, onPrevious });
  }
  function settled() { locked.current = false; setMoving(false); }
  useEffect(() => { readerRef.current?.focus({ preventScroll: true }); }, [item.id]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) onClose(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [onClose]);
  return <section ref={readerRef} tabIndex={-1} role="dialog" aria-modal="true" className="reader" aria-label="Newsletter reader">
    <header className="reader-toolbar"><button className="back-button" onClick={onClose} aria-label="Back to feed">←</button><span className="book-publisher">{item.sender}</span><ReadingSettings isRead={isRead} savingRead={savingRead} onToggleRead={onToggleRead}/></header>
    <ReaderPages id={item.id} title={item.subject} html={doc} channel={gestureChannel} direction={direction} onSwipe={navigate} onSettled={settled}/>
    {statusError && <p className="reader-status-message" role="alert">{statusError}</p>}
    <footer className="reader-footer"><button disabled={!onPrevious || moving} onClick={() => navigate('previous')} aria-label="Previous newsletter">↑</button><span className="book-position">{position}</span><button disabled={!onNext || moving} onClick={() => navigate('next')} aria-label="Next newsletter">↓</button></footer>
  </section>;
}
export default function App() {
  const { token, email, signIn, signOut, restoreSession, serverManaged, loading: signingIn, error: authError } = useAuth();
  const feed = useFeed();
  const [demo, setDemo] = useState(true);
  const [demoFilter, setDemoFilter] = useState('');
  const reading = useReadingState();
  const [setup, setSetup] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const readerItems = useRef<Newsletter[]>([]);
  useEffect(() => { void restoreSession(); }, [restoreSession]);
  useEffect(() => { shell.current?.toggleAttribute('inert', !!selected || setup); }, [selected, setup]);
  useEffect(() => {
    if (serverManaged) { setReady(true); setGoogleError(''); return; }
    let active = true; setReady(false); setGoogleError('');
    void prepareGoogle().then(() => { if (active) setReady(!!getClientId()); }).catch(error => { if (active) setGoogleError(error.message); });
    return () => { active = false; };
  }, [configVersion, serverManaged]);
  useEffect(() => { if (token) { setDemo(false); setSelected(null); } }, [token]);
  useEffect(() => {
    if (!sentinel.current || demo || !feed.hasMore || feed.loading || feed.refreshing || feed.error) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting) void feed.load(); }, { rootMargin: '300px' });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [demo, feed.hasMore, feed.loading, feed.refreshing, feed.error, feed.load]);
  const availableItems = demo ? DEMO.filter(item => !demoFilter || item.source.id === demoFilter) : feed.items;
  const items = availableItems;
  const isRead = (item: Newsletter) => demo ? reading.isRead(item.id) : feed.isRead(item);
  const sources = demo ? [DEMO[0].source] : feed.sources;
  // Keep the open edition stable while background refresh updates the feed.
  const index = readerItems.current.findIndex(item => item.id === selected);
  const current = availableItems.find(item => item.id === selected) ?? readerItems.current[index];
  const scrollPosition = useRef(0);
  function show(item: Newsletter) { if (demo) reading.setRead(item.id, true); else if (token?.canMarkRead) void feed.setRead(item.id, true); setSelected(item.id); }
  function open(item: Newsletter) { scrollPosition.current = window.scrollY; readerItems.current = [...items]; show(item); }
  function close() { setSelected(null); requestAnimationFrame(() => window.scrollTo(0, scrollPosition.current)); }
  useEffect(() => { document.body.style.overflow = selected ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [selected]);
  return <>
    <div className="app-shell" ref={shell}>
      <header className="app-header"><a href="#" className="brand" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><SignalMark/><span>AI Signal<span className="brand-dot">.</span></span></a><div className="header-actions">{demo ? <span className="demo-badge">Demo</span> : <button className={`icon-button ${feed.loading || feed.refreshing ? 'spinning' : ''}`} onClick={() => void feed.refresh()} disabled={feed.loading || feed.refreshing} aria-label="Refresh newsletters"><RefreshIcon/></button>}<ReadingSettings className="feed-reading-settings" onSetup={!serverManaged ? () => setSetup(true) : undefined}/>{email && <button className="text-button" onClick={() => { void signOut().then(done => { if (done) { setSelected(null); setDemo(true); } }); }}>Sign out</button>}</div></header>
      <main className="main-column">
        <section className="feed-intro"><h1>Your daily signal.</h1></section>
        {demo && <SignIn ready={ready || serverManaged} onSetup={() => setSetup(true)}/>}
        {googleError && demo && <p className="notice" role="status">{googleError} <button onClick={() => setConfigVersion(value => value + 1)}>Retry</button></p>}
        <div className="feed-bar"><select aria-label="Filter by newsletter" className="newsletter-filter" value={demo ? demoFilter : feed.sourceFilter?.id ?? ''} onChange={event => { setSelected(null); if (demo) setDemoFilter(event.target.value); else feed.setSourceFilter(sources.find(source => source.id === event.target.value) ?? null); }}><option value="">All newsletters</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select><span className="label-pill">_AI_SIGNAL</span></div>
        {!demo && token && (!token.canMarkRead || feed.expired) && <div className="sync-notice"><span>Reconnect Gmail to sync read/unread status.</span><button disabled={signingIn} onClick={() => void signIn()}>Reconnect Gmail</button></div>}
        {!demo && feed.cacheWarning && <p className="source-notice" role="status">Device storage is unavailable. Editions will load from Gmail each visit.</p>}
        {!demo && feed.statusError && <p className="source-notice" role="alert">{feed.statusError}</p>}
        {!demo && email && <div className="account-line">{email}<span>{feed.updated ? 'Updated ' + new Date(feed.updated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Connecting…'}</span></div>}
        {(!demo && (feed.error || authError)) && <div className="notice" role="alert"><p>{feed.error || authError}</p>{feed.expired ? <button className="primary" disabled={signingIn || (!ready && !serverManaged)} onClick={() => void signIn()}>{signingIn ? 'Connecting…' : 'Reconnect Google'}</button> : <button onClick={() => void feed.refresh()}>Try again</button>}</div>}
        {!demo && feed.sourceError && <p className="source-notice" role="status">{feed.sourceError}</p>}
        <div className="edition-list">{items.map((item, i) => <article key={item.id} className={`edition ${isRead(item) ? 'edition-read' : 'edition-unread'}`}><div className="edition-top"><div className={`publisher-row source-${i % 3}`}><span className="avatar">{item.sender.charAt(0)}</span><span>{item.sender}</span></div><span className="edition-date">{dateLabel(item.date)}</span></div><a className="edition-open" href={`#edition-${encodeURIComponent(item.id)}`} aria-label={`${item.subject}${isRead(item) ? '' : ' — unread'}`} onClick={event => { event.preventDefault(); open(item); }}><h2>{item.subject}</h2><p className="edition-excerpt">{previewText(item)}</p></a><div className="edition-bottom"><span>{item.readMinutes} min read</span></div></article>)}</div>
        {feed.loading && !demo && <div role="status" className="loading"><span className="loading-dot"/> Gathering your newsletters…</div>}
        {!demo && !feed.loading && !feed.error && !items.length && <div className="empty-state"><SignalMark/><h2>A little quiet here.</h2><p>{feed.sourceFilter ? 'No editions found for this newsletter.' : <>Add newsletters to <strong>_AI_SIGNAL</strong> in Gmail, then refresh.</>}</p><button className="primary" onClick={() => void feed.refresh()}>Refresh feed</button></div>}
        <div ref={sentinel}/>{!demo && feed.hasMore && <button className="load-more" disabled={feed.loading} onClick={() => void feed.load()}>Load more editions ↓</button>}

      </main>
    </div>
    {current && <Reader item={current} onClose={close} position={`${index + 1} / ${readerItems.current.length}`} statusError={demo ? undefined : feed.statusError} isRead={isRead(current)} savingRead={feed.updatingIds.includes(current.id)} onToggleRead={demo ? () => reading.setRead(current.id, !reading.isRead(current.id)) : token?.canMarkRead ? () => { void feed.setRead(current.id, !isRead(current)); } : undefined} onPrevious={index > 0 ? () => show(readerItems.current[index - 1]) : undefined} onNext={index < readerItems.current.length - 1 ? () => show(readerItems.current[index + 1]) : undefined}/>}
    {setup && <Setup onClose={() => setSetup(false)} onSave={() => { setSetup(false); setConfigVersion(value => value + 1); void signOut().then(done => { if (done) setDemo(true); }); }}/>}
  </>;
}
