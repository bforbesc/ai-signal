// Server-only Gmail authorization, owned by the authenticated Sites visitor.
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const DEFAULT_ID = '198520129642-pr18hqs7sa8cj3e2u3jqer8koj2cv45l.apps.googleusercontent.com';
const DEFAULT_ORIGIN = 'https://ai-signal-reader.opalash6.chatgpt.site';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/';
interface Statement { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; run(): Promise<unknown> }
interface Database { prepare(sql: string): Statement }
export interface SessionEnvironment { DB?: Database; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; APP_ENCRYPTION_KEY?: string; APP_ORIGIN?: string }
interface Grant { accessToken: string; refreshToken: string; expiresAt: number; email: string }
interface Connection { version: string; encrypted: string }
interface GoogleTokens { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string }
class SessionError extends Error { constructor(message: string, public status = 400) { super(message); } }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
function encoded(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function decoded(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
function random(): string { return encoded(crypto.getRandomValues(new Uint8Array(32))); }
async function hash(value: string): Promise<string> { return encoded(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
function origin(env: SessionEnvironment): string { return new URL(env.APP_ORIGIN || DEFAULT_ORIGIN).origin; }
function configured(env: SessionEnvironment): boolean { try { return !!env.DB && !!env.GOOGLE_CLIENT_SECRET && decoded(env.APP_ENCRYPTION_KEY || '').length === 32; } catch { return false; } }
async function encrypt(env: SessionEnvironment, user: string, grant: Grant): Promise<string> {
  const key = await crypto.subtle.importKey('raw', decoded(env.APP_ENCRYPTION_KEY!), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(user) }, key, new TextEncoder().encode(JSON.stringify(grant)));
  return `${encoded(iv)}.${encoded(new Uint8Array(data))}`;
}
async function decrypt(env: SessionEnvironment, user: string, value: string): Promise<Grant> {
  const [iv, data] = value.split('.');
  const key = await crypto.subtle.importKey('raw', decoded(env.APP_ENCRYPTION_KEY!), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decoded(iv), additionalData: new TextEncoder().encode(user) }, key, decoded(data));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
function cookieName(env: SessionEnvironment): string { return origin(env).startsWith('https:') ? '__Host-ai-signal-oauth' : 'ai-signal-oauth-dev'; }
function cookie(env: SessionEnvironment, value: string, maxAge: number): string { return `${cookieName(env)}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${origin(env).startsWith('https:') ? '; Secure' : ''}`; }
function stateCookie(request: Request, env: SessionEnvironment): string { const name = cookieName(env); return request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? ''; }
function redirect(env: SessionEnvironment, path: string): Response { return new Response(null, { status: 303, headers: { Location: new URL(path, origin(env)).href, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'Set-Cookie': cookie(env, '', 0) } }); }
async function tokens(env: SessionEnvironment, values: Record<string, string>): Promise<GoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID || DEFAULT_ID, client_secret: env.GOOGLE_CLIENT_SECRET!, ...values }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const result = await response.json() as GoogleTokens;
  if (!response.ok || result.error || !result.access_token || !Number.isFinite(result.expires_in) || result.expires_in! <= 0) throw new SessionError(result.error === 'invalid_grant' ? 'Reconnect Gmail to continue.' : 'Google could not renew Gmail access. Please try again.', result.error === 'invalid_grant' ? 401 : 502);
  return result;
}
async function connection(env: SessionEnvironment, user: string, force = false): Promise<Grant> {
  const row = await env.DB!.prepare('SELECT version, encrypted FROM gmail_connections WHERE user_id = ?').bind(user).first<Connection>();
  if (!row) throw new SessionError('Connect Gmail to open your feed.', 401);
  let grant: Grant;
  try { grant = await decrypt(env, user, row.encrypted); } catch { throw new SessionError('Reconnect Gmail to restore this connection.', 401); }
  if (!force && grant.expiresAt > Date.now() + 60000) return grant;
  try {
    const renewed = await tokens(env, { grant_type: 'refresh_token', refresh_token: grant.refreshToken });
    const next = { ...grant, accessToken: renewed.access_token!, refreshToken: renewed.refresh_token || grant.refreshToken, expiresAt: Date.now() + renewed.expires_in! * 1000 };
    // UPDATE cannot recreate a connection deleted by concurrent sign-out.
    await env.DB!.prepare('UPDATE gmail_connections SET encrypted = ?, updated_at = ? WHERE user_id = ? AND version = ?').bind(await encrypt(env, user, next), Date.now(), user, row.version).run();
    return next;
  } catch (error) {
    if (error instanceof SessionError && error.status === 401) await env.DB!.prepare('DELETE FROM gmail_connections WHERE user_id = ? AND version = ?').bind(user, row.version).run();
    throw error;
  }
}
async function gmail(env: SessionEnvironment, user: string, path: string, params: URLSearchParams = new URLSearchParams()): Promise<Record<string, any>> {
  const get = (token: string) => fetch(`${GMAIL}${path}?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  let response = await get((await connection(env, user)).accessToken);
  if (response.status === 401) response = await get((await connection(env, user, true)).accessToken);
  if (!response.ok) throw new SessionError(response.status === 401 ? 'Reconnect Gmail to continue.' : response.status === 429 ? 'Gmail is busy. Please try again shortly.' : 'Gmail could not load this request.', response.status);
  return response.json();
}
async function gmailProxy(request: Request, env: SessionEnvironment, user: string, path: string): Promise<Response> {
  const query = new URL(request.url).searchParams;
  if (path === 'profile') { const profile = await gmail(env, user, 'profile'); return json({ emailAddress: profile.emailAddress }); }
  const labels = await gmail(env, user, 'labels');
  const label = labels.labels?.find((item: { name: string }) => item.name === '_AI_SIGNAL');
  if (path === 'labels') return json({ labels: label ? [label] : [] });
  if (!label) throw new SessionError('Create the _AI_SIGNAL label in Gmail and add your newsletters, then refresh.', 404);
  if (path === 'messages') {
    const params = new URLSearchParams({ labelIds: label.id, maxResults: String(Math.min(100, Math.max(1, Number(query.get('maxResults')) || 12))) });
    const cursor = query.get('pageToken'); if (cursor && cursor.length <= 2048) params.set('pageToken', cursor);
    const filter = query.get('q'); if (filter && filter.length <= 512 && /^(?:list|from):"[^"\r\n]+"$/.test(filter)) params.set('q', filter);
    return json(await gmail(env, user, 'messages', params));
  }
  const match = path.match(/^messages\/([a-zA-Z0-9_-]+)(?:\/attachments\/([a-zA-Z0-9_-]+))?$/);
  if (!match) throw new SessionError('Unknown Gmail route.', 404);
  const messagePath = `messages/${match[1]}`;
  const format = match[2] || query.get('format') === 'metadata' ? 'metadata' : 'full';
  const params = new URLSearchParams({ format });
  if (format === 'metadata') { params.append('metadataHeaders', 'From'); params.append('metadataHeaders', 'List-Id'); }
  const message = await gmail(env, user, messagePath, params);
  if (!message.labelIds?.includes(label.id)) throw new SessionError('This message is outside _AI_SIGNAL.', 404);
  return json(match[2] ? await gmail(env, user, `${messagePath}/attachments/${match[2]}`) : message);
}
export async function handleGoogleSession(request: Request, env: SessionEnvironment): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (url.origin !== origin(env)) throw new SessionError('Request origin was refused.', 403);
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user) throw new SessionError('Sign in to AI Signal to continue.', 401);
    const path = url.pathname;
    if (path === '/api/auth/session' && request.method === 'GET') {
      if (!configured(env)) return json({ configured: false, connected: false });
      try { const grant = await connection(env, user); return json({ configured: true, connected: true, email: grant.email }); }
      catch (error) { if (error instanceof SessionError && error.status === 401) return json({ configured: true, connected: false }); throw error; }
    }
    if (!configured(env)) throw new SessionError('Persistent Gmail connection needs server configuration.', 503);
    if (path === '/api/auth/logout' && request.method === 'POST') {
      if (request.headers.get('origin') !== origin(env)) throw new SessionError('Request origin was refused.', 403);
      await env.DB!.prepare('DELETE FROM gmail_connections WHERE user_id = ?').bind(user).run();
      await env.DB!.prepare('DELETE FROM gmail_oauth_states WHERE user_id = ?').bind(user).run();
      return json({ connected: false });
    }
    if (path === '/api/auth/google/start' && request.method === 'GET') {
      if (request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.get('purpose') === 'prefetch') throw new SessionError('Open Connect Gmail in AI Signal.', 403);
      const state = random();
      await env.DB!.prepare('DELETE FROM gmail_oauth_states WHERE user_id = ? OR expires_at < ?').bind(user, Date.now()).run();
      await env.DB!.prepare('INSERT INTO gmail_oauth_states (state_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await hash(state), user, Date.now() + 600000).run();
      const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      target.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID || DEFAULT_ID, redirect_uri: `${origin(env)}/api/auth/google/callback`, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state, include_granted_scopes: 'false' }).toString();
      return new Response(null, { status: 303, headers: { Location: target.href, 'Set-Cookie': cookie(env, state, 600), 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    if (path === '/api/auth/google/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state') || '';
      if (!state || state.length > 100 || state !== stateCookie(request, env)) throw new SessionError('Google connection expired. Start Connect Gmail again.', 403);
      const proof = await env.DB!.prepare('DELETE FROM gmail_oauth_states WHERE state_hash = ? AND user_id = ? AND expires_at > ? RETURNING user_id').bind(await hash(state), user, Date.now()).first<{ user_id: string }>();
      if (!proof) throw new SessionError('Google connection expired. Start Connect Gmail again.', 403);
      if (url.searchParams.has('error')) return redirect(env, '/?gmail_connection=cancelled');
      const code = url.searchParams.get('code'); if (!code || code.length > 4096) throw new SessionError('Google did not return a valid connection code.');
      const result = await tokens(env, { code, grant_type: 'authorization_code', redirect_uri: `${origin(env)}/api/auth/google/callback` });
      if (!result.scope?.split(' ').includes(SCOPE) || !result.refresh_token) throw new SessionError('Allow read-only Gmail access and reconnect to enable automatic renewal.');
      const response = await fetch(`${GMAIL}profile`, { headers: { Authorization: `Bearer ${result.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new SessionError('Google connected, but Gmail could not open. Try again.', 502);
      const profile = await response.json() as { emailAddress: string };
      const grant: Grant = { accessToken: result.access_token!, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in! * 1000, email: profile.emailAddress };
      await env.DB!.prepare('INSERT INTO gmail_connections (user_id, version, encrypted, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET version = excluded.version, encrypted = excluded.encrypted, updated_at = excluded.updated_at').bind(user, random(), await encrypt(env, user, grant), Date.now()).run();
      return redirect(env, '/?gmail_connection=connected');
    }
    if (path.startsWith('/api/gmail/') && request.method === 'GET') return await gmailProxy(request, env, user, path.slice('/api/gmail/'.length));
    return json({ error: 'Unknown route or method.' }, 404);
  } catch (error) { return json({ error: error instanceof SessionError ? error.message : 'The Gmail connection could not complete. Please try again.' }, error instanceof SessionError ? error.status : 502); }
}
