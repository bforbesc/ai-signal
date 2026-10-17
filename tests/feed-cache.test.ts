import test from 'node:test';
import assert from 'node:assert/strict';
import { CACHE_LIMIT, clearFeedCache, feedSnapshot, readFeedCache, saveFeedCache } from '../src/lib/feed-cache.ts';
import { mapMessage } from '../src/lib/gmail.ts';

test('the device snapshot keeps only the latest 30 editions and their correct older-page cursor', () => {
  const items = Array.from({ length: 70 }, (_, i) => mapMessage({ id: String(i), internalDate: String(i + 1) }));
  const saved = feedSnapshot([...items, items[69]], [], 'after-first-thirty', 100);
  assert.equal(saved.items.length, CACHE_LIMIT);
  assert.equal(saved.items[0].id, '69'); assert.equal(saved.items[29].id, '40');
  assert.equal(saved.nextPageToken, 'after-first-thirty'); assert.equal(saved.updatedAt, 100);
});

test('unavailable device storage falls back to Gmail without crashing', async () => {
  assert.equal(await readFeedCache('reader@example.com'), null);
  assert.equal(await saveFeedCache('reader@example.com', feedSnapshot([], [])), false);
  assert.equal(await clearFeedCache('reader@example.com'), true);
});
