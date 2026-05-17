import { SignIn } from './components/SignIn';
import { useAuth } from './store/useAuth';

export default function App() {
  const { email, signOut } = useAuth();

  if (!email) {
    return <SignIn />;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 h-12 w-12 rounded-xl bg-gradient-to-br from-alpha to-batch" />
      <p className="text-xs uppercase tracking-widest text-zinc-500">Signed in as</p>
      <p className="mt-1 text-lg font-medium">{email}</p>
      <p className="mt-6 max-w-xs text-sm text-zinc-400">
        Auth smoke test passed. Next up: fetch <code>label:_AI_SIGNAL</code> and render the feed.
      </p>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
        className="mt-10 rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition active:scale-[0.98]"
      >
        Sign out
      </button>
    </div>
  );
}
