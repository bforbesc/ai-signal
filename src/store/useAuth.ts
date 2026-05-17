import { create } from 'zustand';
import {
  type AccessToken,
  fetchGmailProfile,
  requestAccessToken,
  revokeToken,
} from '../lib/auth';

interface AuthState {
  token: AccessToken | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  email: null,
  loading: false,
  error: null,

  async signIn() {
    set({ loading: true, error: null });
    try {
      const token = await requestAccessToken();
      const profile = await fetchGmailProfile(token.value);
      set({ token, email: profile.emailAddress, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async signOut() {
    const { token } = get();
    if (token) await revokeToken(token.value);
    set({ token: null, email: null, error: null });
  },
}));
