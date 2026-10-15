import { create } from 'zustand';
import { type AccessToken, fetchGmailProfile, requestAccessToken } from '../lib/auth';
interface AuthState {
  token: AccessToken | null; email: string | null; loading: boolean; error: string | null;
  signIn: () => Promise<void>; signOut: () => void;
}
let generation = 0;
export const useAuth = create<AuthState>((set, get) => ({
  token: null, email: null, loading: false, error: null,
  async signIn() {
    if (get().loading) return;
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
  signOut() { generation++; set({ token: null, email: null, loading: false, error: null }); },
}));
