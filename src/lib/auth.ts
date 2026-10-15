// Google Identity Services access tokens stay in memory. Only the public client ID is saved.
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
interface TokenResponse { access_token: string; expires_in: number; scope: string; error?: string }
interface TokenClient { requestAccessToken: (options: { prompt: string }) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient: (config: { client_id: string; scope: string; include_granted_scopes: boolean; callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void }) => TokenClient;
    } } };
  }
}
export interface AccessToken { value: string; expiresAt: number }
export function getClientId(): string {
  return localStorage.getItem('ai-signal-client-id') || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
}
export function saveClientId(value: string) { localStorage.setItem('ai-signal-client-id', value.trim()); client = null; }
let client: TokenClient | null = null;
let pending: { resolve: (value: AccessToken) => void; reject: (error: Error) => void } | null = null;
export async function prepareGoogle(): Promise<void> {
  client = null;
  const id = getClientId();
  if (!id) return;
  const start = Date.now();
  while (!window.google?.accounts?.oauth2) {
    if (Date.now() - start > 12000) throw new Error('Google sign-in could not load. Check your connection or content blocker and retry.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  client = window.google.accounts.oauth2.initTokenClient({
    client_id: id, scope: SCOPE, include_granted_scopes: false,
    callback: response => {
      const request = pending; pending = null;
      if (response.error) request?.reject(new Error(response.error));
      else if (!response.scope?.split(' ').includes(SCOPE)) request?.reject(new Error('Allow read-only Gmail access to load your newsletters.'));
      else request?.resolve({ value: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 });
    },
    error_callback: error => {
      const request = pending; pending = null;
      request?.reject(new Error(error.type === 'popup_closed' ? 'Sign-in was closed. You can try again.' : 'Allow the Google sign-in window in Chrome, then try again.'));
    },
  });
}
// Deliberately synchronous until requestAccessToken: keeps the iPhone user gesture intact.
export function requestAccessToken(): Promise<AccessToken> {
  if (!client) return Promise.reject(new Error('Finish Google setup and wait for sign-in to be ready.'));
  if (pending) return Promise.reject(new Error('Google sign-in is already open.'));
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    try { client!.requestAccessToken({ prompt: '' }); }
    catch (error) { pending = null; reject(error); }
  });
}
export async function fetchGmailProfile(token: string): Promise<{ emailAddress: string }> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not connect to Gmail. Check the Gmail API and your read-only permission.');
  return response.json();
}
