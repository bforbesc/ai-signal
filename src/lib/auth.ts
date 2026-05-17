// Thin wrapper around Google Identity Services token client.
// Returns an OAuth 2.0 access token scoped to gmail.readonly.
// The token lives in memory + IndexedDB (see db.ts); GIS handles PKCE for us.

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export interface AccessToken {
  value: string;
  /** Unix ms when this token expires. */
  expiresAt: number;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function waitForGis(timeoutMs = 8000): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Identity Services failed to load.'));
      }
    }, 50);
  });
}

let cachedClient: TokenClient | null = null;
let pendingResolve: ((token: AccessToken) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

async function getTokenClient(): Promise<TokenClient> {
  if (!CLIENT_ID) {
    throw new Error(
      'Missing VITE_GOOGLE_CLIENT_ID. Copy .env.example to .env and set your OAuth client ID.',
    );
  }
  await waitForGis();
  if (cachedClient) return cachedClient;

  cachedClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: GMAIL_READONLY_SCOPE,
    callback: (response) => {
      if (response.error) {
        pendingReject?.(new Error(response.error));
      } else {
        pendingResolve?.({
          value: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
        });
      }
      pendingResolve = null;
      pendingReject = null;
    },
  });
  return cachedClient;
}

/**
 * Request a Gmail access token. Must be called from a direct user gesture on iOS
 * standalone, otherwise the popup may be blocked.
 */
export async function requestAccessToken(prompt: '' | 'consent' = ''): Promise<AccessToken> {
  const client = await getTokenClient();
  return new Promise<AccessToken>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    client.requestAccessToken({ prompt });
  });
}

export function revokeToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    window.google.accounts.oauth2.revoke(token, () => resolve());
  });
}

/**
 * Fetch the authenticated user's Gmail profile — used as a smoke test that the
 * token is valid and the Gmail scope was actually granted.
 */
export async function fetchGmailProfile(accessToken: string): Promise<{
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}> {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok) {
    throw new Error(`Gmail profile request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
