import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleGoogleSession } from '../server/google-session.ts';
import { readSession, disconnectSession } from '../src/lib/session.ts';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const app = 'https://reader.example';
const scope = 'https://www.googleapis.com/auth/gmail.modify';
function context() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../drizzle/0000_pretty_hannibal_king.sql', import.meta.url), 'utf8'));
  const env = { APP_ORIGIN: app, GOOGLE_CLIENT_SECRET: 'test-secret', APP_ENCRYPTION_KEY: btoa('x'.repeat(32)), DB: { prepare(sql: string) {
    let values: any[] = [];
    const stmt = { bind(...args: unknown[]) { values = args; return stmt; }, async first<T>() { return (db.prepare(sql).get(...values) ?? null) as T | null; }, async run() { return db.prepare(sql).run(...values); } };
    return stmt;
  } } };
  const request = (path: string, init: RequestInit = {}, user = 'owner') => new Request(app + path, { ...init, headers: { 'oai-authenticated-user-id': user, ...Object.fromEntries(new Headers(init.headers).entries()) } });
  const call = (path: string, init?: RequestInit, user?: string) => handleGoogleSession(request(path, init, user), env);
  return { env, db, request, call };
}
function google(expires = 3600, grantedScope = scope) {
  let refreshed = 0;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url === 'https://oauth2.googleapis.com/token') {
      const refresh = String(init?.body).includes('grant_type=refresh_token'); if (refresh) refreshed++;
      return Response.json({ access_token: refresh ? 'renewed-test-access' : 'test-access', refresh_token: refresh ? undefined : 'test-refresh', expires_in: refresh ? 3600 : expires, scope: grantedScope });
    }
    if (url.includes('/profile')) return Response.json({ emailAddress: 'reader@example.com', historyId: '12345678901234567890' });
    if (url.includes('/labels')) return Response.json({ labels: [{ id: 'allowed', name: '_AI_SIGNAL' }, { id: 'INBOX', name: 'INBOX' }] });
    if (url.includes('/messages/private')) return Response.json({ id: 'private', labelIds: ['INBOX'] });
    if (url.includes('/messages/edition')) return Response.json({ id: 'edition', labelIds: ['allowed'] });
    if (url.includes('/messages')) return Response.json({ messages: [{ id: 'edition' }] });
    throw new Error('Unexpected provider request');
  };
  return { calls, refreshes: () => refreshed };
}
async function start(ctx: ReturnType<typeof context>) {
  const response = await ctx.call('/api/auth/google/start');
  assert.equal(response.status, 303);
  const target = new URL(response.headers.get('location')!);
  return { state: target.searchParams.get('state')!, cookie: response.headers.get('set-cookie')!.split(';')[0], target };
}
async function connect(ctx: ReturnType<typeof context>) {
  const flow = await start(ctx);
  const response = await ctx.call(`/api/auth/google/callback?code=test-code&state=${flow.state}`, { headers: { cookie: flow.cookie } });
  assert.equal(response.status, 303); return flow;
}
test('persistent session is private, and an unconfigured server exposes no credentials', async () => {
  const ctx = context();
  const denied = await handleGoogleSession(new Request(app + '/api/auth/session'), ctx.env); assert.equal(denied.status, 401);
  const result = await handleGoogleSession(ctx.request('/api/auth/session'), { ...ctx.env, GOOGLE_CLIENT_SECRET: undefined });
  assert.deepEqual(await result.json(), { configured: false, connected: false }); assert.equal(result.headers.get('cache-control'), 'private, no-store');
});
test('authorization is offline with Gmail status sync; callback stores encrypted tokens, not browser tokens', async () => {
  const ctx = context(); google(); const flow = await connect(ctx);
  assert.equal(flow.target.searchParams.get('access_type'), 'offline'); assert.equal(flow.target.searchParams.get('scope'), scope);
  assert.equal(flow.target.searchParams.get('redirect_uri'), app + '/api/auth/google/callback');
  const row = ctx.db.prepare('SELECT * FROM gmail_connections').get()!;
  assert.ok(!String(row.encrypted).includes('test-access')); assert.ok(!String(row.encrypted).includes('test-refresh')); assert.ok(!String(row.encrypted).includes('reader@example.com'));
  const status = await ctx.call('/api/auth/session'); assert.deepEqual(await status.json(), { configured: true, connected: true, email: 'reader@example.com', canMarkRead: true });
});
test('reopening restores an expired access grant using its refresh token', async () => {
  const ctx = context(); const mock = google(1); await connect(ctx);
  const response = await handleGoogleSession(ctx.request('/api/auth/session'), { ...ctx.env });
  assert.equal(((await response.json()) as {connected:boolean}).connected, true); assert.equal(mock.refreshes(), 1);
  await ctx.call('/api/auth/session'); assert.equal(mock.refreshes(), 1);
});
test('OAuth callback requires the browser cookie, visitor binding, and a fresh single-use state', async () => {
  const ctx = context(); google(); const flow = await start(ctx);
  const path = `/api/auth/google/callback?code=test-code&state=${flow.state}`;
  assert.equal((await ctx.call(path)).status, 403);
  assert.equal((await ctx.call(path, { headers: { cookie: flow.cookie } }, 'other-user')).status, 403);
  assert.equal((await ctx.call(path, { headers: { cookie: flow.cookie } })).status, 303);
  assert.equal((await ctx.call(path, { headers: { cookie: flow.cookie } })).status, 403);
  const expired = await start(ctx); ctx.db.prepare('UPDATE gmail_oauth_states SET expires_at = 0').run();
  assert.equal((await ctx.call(`/api/auth/google/callback?code=test-code&state=${expired.state}`, { headers: { cookie: expired.cookie } })).status, 403);
});
test('another visitor cannot use the saved Gmail grant', async () => {
  const ctx = context(); google(); await connect(ctx);
  assert.deepEqual(await (await ctx.call('/api/auth/session', {}, 'other-user')).json(), { configured: true, connected: false });
  assert.equal((await ctx.call('/api/gmail/messages', {}, 'other-user')).status, 401);
});
test('the lightweight change check returns a string marker only to the connected visitor', async () => {
  const ctx = context(); google(); await connect(ctx);
  const response = await ctx.call('/api/gmail/profile');
  assert.deepEqual(await response.json(), { emailAddress: 'reader@example.com', historyId: '12345678901234567890' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await ctx.call('/api/gmail/profile', {}, 'other-user')).status, 401);
});
test('server enforces the label even if a client asks for inbox mail or attachments', async () => {
  const ctx = context(); const mock = google(); await connect(ctx);
  const result = await ctx.call('/api/gmail/messages?labelIds=INBOX&maxResults=999'); assert.equal(result.status, 200);
  const listCall = mock.calls.find(call => call.url.includes('/messages?'))!;
  const query = new URL(listCall.url).searchParams; assert.equal(query.get('labelIds'), 'allowed'); assert.equal(query.get('maxResults'), '100');
  const labels = await ctx.call('/api/gmail/labels'); assert.deepEqual(((await labels.json()) as {labels:unknown[]}).labels, [{ id: 'allowed', name: '_AI_SIGNAL' }]);
  assert.equal((await ctx.call('/api/gmail/messages/private')).status, 404);
  assert.equal((await ctx.call('/api/gmail/messages/private/attachments/secret')).status, 404);
  assert.ok(!mock.calls.some(call => call.url.includes('/attachments/')));
});
test('sign-out requires a same-origin POST and removes both connection and pending authorization', async () => {
  const ctx = context(); google(); await connect(ctx); await start(ctx);
  assert.equal((await ctx.call('/api/auth/logout', { method: 'POST', headers: { origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await ctx.call('/api/auth/logout', { method: 'POST', headers: { origin: app } })).status, 200);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM gmail_connections').get()!.n, 0);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM gmail_oauth_states').get()!.n, 0);
  assert.equal(((await (await ctx.call('/api/auth/session')).json()) as {connected:boolean}).connected, false);
});
test('revoked renewal asks to reconnect and removes the unusable grant', async () => {
  const ctx = context(); google(1); await connect(ctx);
  globalThis.fetch = async () => Response.json({ error: 'invalid_grant' }, { status: 400 });
  assert.equal(((await (await ctx.call('/api/auth/session')).json()) as {connected:boolean}).connected, false);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM gmail_connections').get()!.n, 0);
});
test('temporary renewal failure preserves the connection for retry', async () => {
  const ctx = context(); google(1); await connect(ctx);
  globalThis.fetch = async () => Response.json({ error: 'temporarily_unavailable' }, { status: 503 });
  assert.equal((await ctx.call('/api/auth/session')).status, 502);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM gmail_connections').get()!.n, 1);
});
test('a Gmail 401 renews access once without sending the user through sign-in', async () => {
  const ctx = context(); const mock = google(); await connect(ctx); const provider = globalThis.fetch;
  let refused = false;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/labels') && !refused) { refused = true; return new Response(null, { status: 401 }); }
    return provider(input, init);
  };
  assert.equal((await ctx.call('/api/gmail/messages')).status, 200); assert.equal(mock.refreshes(), 1);
});
test('an in-flight renewal cannot recreate a signed-out connection', async () => {
  const ctx = context(); google(1); await connect(ctx);
  let release!: () => void; let started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  globalThis.fetch = async () => { started(); await pending; return Response.json({ access_token: 'renewed-test-access', expires_in: 3600 }); };
  const restoring = ctx.call('/api/auth/session'); await entered;
  await ctx.call('/api/auth/logout', { method: 'POST', headers: { origin: app } });
  release(); await restoring;
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM gmail_connections').get()!.n, 0);
  assert.equal(((await (await ctx.call('/api/auth/session')).json()) as { connected: boolean }).connected, false);
});
test('browser session restoration handles static hosting and does not persist tokens', async () => {
  globalThis.fetch = async () => new Response('<html>Static app</html>', { headers: { 'content-type': 'text/html' } });
  assert.equal((await readSession()).available, false);
  globalThis.fetch = async (_input, init) => { assert.equal(init?.cache, 'no-store'); return Response.json({ configured: true, connected: true, email: 'reader@example.com' }); };
  assert.deepEqual(await readSession(), { available: true, configured: true, connected: true, email: 'reader@example.com', canMarkRead: false });
  globalThis.fetch = async (_input, init) => { assert.equal(init?.method, 'POST'); return new Response(null, { status: 200 }); }; await disconnectSession();
});

test('read-status changes only UNREAD after checking the exact label and visitor', async () => {
  const ctx = context(); const mock = google(); await connect(ctx);
  const provider = globalThis.fetch; let labels = ['allowed', 'UNREAD'];
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/messages/edition/modify')) {
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.ok(JSON.stringify(body) === '{"removeLabelIds":["UNREAD"]}' || JSON.stringify(body) === '{"addLabelIds":["UNREAD"]}');
      labels = body.addLabelIds ? ['allowed', 'UNREAD'] : ['allowed'];
      return Response.json({ id: 'edition', labelIds: labels });
    }
    return provider(input, init);
  };
  const write = (id: string, body: unknown, user = 'owner', origin = app) => ctx.call(`/api/gmail/messages/${id}/read-status`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }, user);
  assert.equal((await write('edition', { read: true })).status, 200); assert.deepEqual(labels, ['allowed']);
  assert.equal((await write('edition', { read: false })).status, 200); assert.deepEqual(labels, ['allowed', 'UNREAD']);
  assert.equal((await write('private', { read: true })).status, 404);
  assert.equal((await write('edition', { read: true }, 'other-user')).status, 401);
  assert.equal((await write('edition', { read: true }, 'owner', 'https://attacker.example')).status, 403);
  assert.equal((await write('edition', { read: true, removeLabelIds: ['allowed'] })).status, 400);
  assert.equal((await write('edition', { read: 'yes' })).status, 400);
  assert.ok(!mock.calls.some(call => /\/trash|\/send|\/delete/.test(call.url)));
});

test('existing read-only connections still load but require reconnection before any write', async () => {
  const ctx = context(); const mock = google(3600, 'https://www.googleapis.com/auth/gmail.readonly'); await connect(ctx);
  assert.equal((await (await ctx.call('/api/auth/session')).json() as { canMarkRead: boolean }).canMarkRead, false);
  assert.equal((await ctx.call('/api/gmail/messages')).status, 200);
  const response = await ctx.call('/api/gmail/messages/edition/read-status', { method: 'POST', headers: { origin: app, 'content-type': 'application/json' }, body: '{"read":true}' });
  assert.equal(response.status, 428);
  assert.ok(!mock.calls.some(call => call.url.includes('/modify')));
});
