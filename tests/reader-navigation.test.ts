import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { gestureScript, navigateSwipe, readSwipeMessage, swipeDirection } from '../src/lib/reader-navigation.ts';
const channel = '1234567890abcdef1234567890abcdef';

test('left goes forward and right goes back, while vertical scrolling and small/slow gestures stay put', () => {
  assert.equal(swipeDirection(-100, 5, 200), 'next');
  assert.equal(swipeDirection(100, 5, 200), 'previous');
  for (const args of [[15, 5, 100], [80, 100, 200], [100, 2, 1500]]) assert.equal(swipeDirection(...args as [number, number, number]), null);
});

test('first/last edition boundaries never wrap or call the opposite direction', () => {
  let previous = 0, next = 0;
  navigateSwipe('next', { onPrevious: () => previous++ });
  navigateSwipe('previous', { onNext: () => next++ });
  assert.equal(previous, 0); assert.equal(next, 0);
});

test('messages from another window, old iframe or wrong channel cannot navigate', () => {
  const frame = {} as Window;
  const data = { type: 'ai-signal:swipe', channel, direction: 'next' };
  assert.equal(readSwipeMessage({ source: frame, data }, frame, channel), 'next');
  assert.equal(readSwipeMessage({ source: {} as Window, data }, frame, channel), null);
  assert.equal(readSwipeMessage({ source: frame, data: { ...data, channel: 'other' } }, frame, channel), null);
  assert.equal(readSwipeMessage({ source: frame, data: { ...data, direction: 'wrap' } }, frame, channel), null);
  assert.equal(readSwipeMessage({ source: frame, data: null }, frame, channel), null);
});

test('the isolated gesture bridge emits a channel-bound swipe, ignoring pinch and text selection', () => {
  const listeners = new Map<string, (event: any) => void>();
  const messages: unknown[] = []; let now = 0; let selection = '';
  runInNewContext(gestureScript(channel), {
    document: { addEventListener: (name: string, fn: (event: any) => void) => listeners.set(name, fn) },
    window: { getSelection: () => ({ toString: () => selection }), parent: { postMessage: (value: unknown) => messages.push(value) } },
    Date: { now: () => now },
  });
  const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
  const start = () => { now = 0; listeners.get('touchstart')!({ touches: [touch(200, 300)] }); };
  const end = () => { now = 200; listeners.get('touchend')!({ changedTouches: [touch(70, 302)], preventDefault() {} }); };
  start(); end(); assert.equal(JSON.stringify(messages[0]), JSON.stringify({ type: 'ai-signal:swipe', channel, direction: 'next' }));
  start(); listeners.get('touchmove')!({ touches: [touch(180, 300), touch(200, 300)] }); end();
  selection = 'selected newsletter text'; start(); end();
  assert.equal(messages.length, 1);
  assert.throws(() => gestureScript('invalid-channel'));
});
