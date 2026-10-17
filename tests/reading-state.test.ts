import test from 'node:test';
import assert from 'node:assert/strict';
import { changeReadStatus, loadReadingState, parseReadingState, DEMO_READING_KEY, saveReadingState } from '../src/lib/reading-state.ts';

test('demo read status survives reloading without storing newsletter content', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const key = DEMO_READING_KEY;
  const read = changeReadStatus({ readIds: [] }, 'message-one', true);
  assert.equal(saveReadingState(storage, key, read), true);
  assert.deepEqual(loadReadingState(storage, key), { readIds: ['message-one'] });
  assert.deepEqual(Object.keys(JSON.parse(values.get(key)!)), ['readIds']);
  assert.deepEqual(changeReadStatus(read, 'message-one', false), { readIds: [] });
});

test('corrupt or unexpected saved values recover safely', () => {
  for (const value of [null, '{broken', 'null', '[]', '42']) assert.deepEqual(parseReadingState(value), { readIds: [] });
  assert.deepEqual(parseReadingState('{"readIds":["one","one",1,null,""],"filter":"unexpected"}'), { readIds: ['one'] });
});

test('unavailable browser storage does not break reading', () => {
  const storage = { getItem: (): string | null => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.deepEqual(loadReadingState(storage, 'key'), { readIds: [] });
  assert.equal(saveReadingState(storage, 'key', { readIds: ['one'] }), false);
});
