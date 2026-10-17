export type SwipeDirection = 'next' | 'previous';
export function navigateSwipe(direction: SwipeDirection | null, navigation: { onNext?: () => void; onPrevious?: () => void }): void {
  if (direction === 'next') navigation.onNext?.();
  else if (direction === 'previous') navigation.onPrevious?.();
}
export function swipeDirection(dx: number, dy: number, elapsed: number): SwipeDirection | null {
  if (elapsed > 900 || Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.8) return null;
  return dx < 0 ? 'next' : 'previous';
}

// Runs only our gesture bridge in the opaque-origin iframe, never newsletter JavaScript.
function installGestures(channel: string, detect: typeof swipeDirection) {
  let start: { x: number; y: number; time: number } | null = null;
  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || window.getSelection()?.toString()) { start = null; return; }
    const touch = event.touches[0]; start = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) { start = null; return; }
    if (!start) return;
    const touch = event.touches[0];
    if (detect(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.time)) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    const from = start; start = null;
    if (!from || !touch || window.getSelection()?.toString()) return;
    const direction = detect(touch.clientX - from.x, touch.clientY - from.y, Date.now() - from.time);
    if (!direction) return;
    event.preventDefault();
    window.parent.postMessage({ type: 'ai-signal:swipe', channel, direction }, '*');
  }, { passive: false });
  document.addEventListener('touchcancel', () => { start = null; }, { passive: true });
}

export function gestureScript(channel: string): string {
  if (!/^[a-f0-9]{32}$/.test(channel)) throw new Error('Invalid reader gesture channel');
  return `(${installGestures.toString()})(${JSON.stringify(channel)},${swipeDirection.toString()});`;
}

export function readSwipeMessage(event: Pick<MessageEvent, 'source' | 'data'>, frame: MessageEventSource | null, channel: string): SwipeDirection | null {
  if (!frame || event.source !== frame || event.data?.type !== 'ai-signal:swipe' || event.data.channel !== channel) return null;
  return event.data.direction === 'next' || event.data.direction === 'previous' ? event.data.direction : null;
}
