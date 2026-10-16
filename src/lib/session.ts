export const SERVER_SESSION = 'ai-signal:server-session';
export interface SessionStatus { available: boolean; configured: boolean; connected: boolean; email?: string }
export async function readSession(): Promise<SessionStatus> {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
  // Static deployments retain their existing browser-only Google connection.
  if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) return { available: false, configured: false, connected: false };
  if (!response.ok) throw new Error('Your saved connection could not open. Reload to try again.');
  const value = await response.json() as { configured?: boolean; connected?: boolean; email?: string };
  return { available: true, configured: value.configured === true, connected: value.connected === true && typeof value.email === 'string', email: value.email };
}
export async function disconnectSession(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Could not disconnect Gmail. Check your connection and try again.');
}
