import { useAuth } from '../store/useAuth';

export function SignIn() {
  const { signIn, loading, error } = useAuth();

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 h-16 w-16 rounded-2xl bg-gradient-to-br from-alpha to-batch shadow-lg" />
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">AI Signal</h1>
      <p className="mb-8 max-w-xs text-sm text-zinc-400">
        Read Alpha Signal and The Batch from your Gmail label{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs">_AI_SIGNAL</code>.
      </p>

      <button
        type="button"
        onClick={() => {
          void signIn();
        }}
        disabled={loading}
        className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow transition active:scale-[0.98] disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>

      {error && (
        <p className="mt-6 max-w-xs text-xs text-red-400">{error}</p>
      )}

      <p className="mt-10 max-w-xs text-[11px] leading-relaxed text-zinc-500">
        Read-only access. AI Signal never modifies your Gmail.
      </p>
    </div>
  );
}
