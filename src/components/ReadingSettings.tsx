import { useEffect, useId, useRef, useState } from 'react';
import { useReadingPreferences } from '../store/useReadingPreferences';

export function ReadingSettings({ onToggleRead, isRead, savingRead, onSetup, className = '' }: { onToggleRead?: () => void; isRead?: boolean; savingRead?: boolean; onSetup?: () => void; className?: string }) {
  const { font, original, images, storageUnavailable, resize, chooseLayout, toggleImages } = useReadingPreferences();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  return <div ref={root} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} className={`reading-settings ${open ? 'is-open' : ''} ${className}`}>
    <button ref={toggle} className="type-toggle" aria-label="Reading settings" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>Aa</button>
    {open && <><div className="settings-dismiss" aria-hidden="true" onPointerDown={() => setOpen(false)}/><div id={id} className="settings-panel" aria-label="Reading settings">
      <div className="type-controls"><span>Text size</span><button onClick={() => resize(font - 1)} disabled={font <= 16 || original} aria-label="Smaller text">A−</button><span>{font}</span><button onClick={() => resize(font + 1)} disabled={font >= 24 || original} aria-label="Larger text">A+</button></div>
      <div className="reader-options" role="group" aria-label="Default view"><span>Default view</span><div><button aria-pressed={!original} className={!original ? 'active' : ''} onClick={() => chooseLayout(false)}>Reading view</button><button aria-pressed={original} className={original ? 'active' : ''} onClick={() => chooseLayout(true)}>Email layout</button></div></div>
      <button className="image-preference" aria-pressed={images} onClick={toggleImages}><span>Images</span><span>{images ? 'On' : 'Off'}</span></button>
      {storageUnavailable && <p className="preferences-hint" role="status">Device storage is unavailable. Changes apply for this visit.</p>}
      {onToggleRead && <button className="reading-state-action" disabled={savingRead} onClick={onToggleRead}>{savingRead ? 'Saving to Gmail…' : isRead ? 'Mark as unread' : 'Mark as read'}</button>}
      {onSetup && <button className="reading-state-action" onClick={() => { setOpen(false); onSetup(); }}>Connection setup</button>}
    </div></>}
  </div>;
}
