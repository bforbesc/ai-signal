import { useAuth } from '../store/useAuth';
export function SignIn({ ready, onSetup }: { ready: boolean; onSetup: () => void }) {
  const { loading, restoring, serverManaged, signIn, error } = useAuth();
  return <div className="connect-card">
    <div className="connect-symbol" aria-hidden="true">↗</div>
    <div><h2>Your newsletters, together.</h2><p>Read your _AI_SIGNAL label.</p></div>
    <button className="primary" disabled={loading || restoring} onClick={() => { if (ready || serverManaged) void signIn(); else onSetup(); }}>{restoring ? 'Opening…' : loading ? 'Connecting…' : <><span className="google-g" aria-hidden="true">G</span> Connect Gmail</>}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
