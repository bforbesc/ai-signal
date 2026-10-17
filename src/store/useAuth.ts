import { create } from 'zustand';
import { type AccessToken, fetchGmailProfile, requestAccessToken } from '../lib/auth';
import { SERVER_SESSION, readSession, disconnectSession } from '../lib/session';
import { clearFeedCache } from '../lib/feed-cache';
interface AuthState {
  token: AccessToken | null; email: string | null; loading: boolean; error: string | null;
  restoring: boolean; serverManaged: boolean; serverAvailable: boolean;
  restoreSession: () => Promise<void>; signIn: () => Promise<void>; signOut: () => Promise<boolean>;
}
let generation = 0;
export const useAuth = create<AuthState>((set, get) => ({
  token: null, email: null, loading: false, error: null,
  restoring: false, serverManaged: false, serverAvailable: false,
  async restoreSession() {
    if (get().restoring) return;
    const run = generation; set({ restoring: true });
    try {
      const status = await readSession();
      if (run !== generation) return;
      set({ serverAvailable: status.available, serverManaged: status.configured,
        ...(status.connected ? { token: { value: SERVER_SESSION, expiresAt: Number.MAX_SAFE_INTEGER, canMarkRead: status.canMarkRead }, email: status.email!, error: null } : {}) });
    } catch (error) { if (run === generation) set({ error: error instanceof Error ? error.message : String(error) }); }
    finally { if (run === generation) set({ restoring: false }); }
  },
  async signIn() {
    if (get().loading || get().restoring) return;
    if (get().serverManaged) { window.location.assign('/api/auth/google/start'); return; }
    const run = generation;
    // Trigger the popup before awaiting any network operation.
    const request = requestAccessToken();
    set({ loading: true, error: null });
    try {
      const token = await request;
      const profile = await fetchGmailProfile(token.value);
      if (run === generation) set({ token, email: profile.emailAddress, loading: false });
    } catch (error) {
      if (run === generation) set({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
  async signOut() {
    const account = get().email;
    generation++;
    if (get().serverManaged) {
      set({ loading: true, error: null });
      try { await disconnectSession(); }
      catch (error) { set({ loading: false, error: error instanceof Error ? error.message : String(error) }); return false; }
    }
    set({ token: null, email: null, loading: false, restoring: false, error: null });
    if (account && !await clearFeedCache(account)) set({ error: 'Signed out. Clear this site’s data in browser settings to remove its device cache.' });
    return true;
  },
}));
