import { useState } from 'react';
import { getClientId, saveClientId } from '../lib/auth';
import { useAuth } from '../store/useAuth';
export function Setup({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [value, setValue] = useState(getClientId());
  const [error, setError] = useState('');
  const serverManaged = useAuth(state => state.serverManaged);
  const serverAvailable = useAuth(state => state.serverAvailable);
  if (serverManaged) return <div className="modal-shade"><section role="dialog" aria-modal="true" aria-labelledby="setup-title" className="setup-panel"><button className="close-button" onClick={onClose} aria-label="Close setup">×</button><h2 id="setup-title">Your Gmail connection.</h2><p>Gmail stays connected when you reopen AI Signal. Access renews automatically; Google can still ask you to reconnect if permission changes.</p><p>Only newsletters in <strong>_AI_SIGNAL</strong> are loaded. Reading preferences are saved on this device.</p></section></div>;
  return <div className="modal-shade"><section role="dialog" aria-modal="true" aria-labelledby="setup-title" className="setup-panel">
    <button className="close-button" onClick={onClose} aria-label="Close setup">×</button>
    <p className="eyebrow">ONE-TIME SETUP</p><h2 id="setup-title">Connect your reading feed.</h2>
    <p>Google needs a web client ID for this address. It is free for standard personal use.</p>
    {serverAvailable && <p>Automatic sign-in is prepared but needs server credentials. Until setup is finished, the browser connection expires when the app closes.</p>}
    <ol>
      <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud</a> and create a project named AI Signal.</li>
      <li>Enable <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer">Gmail API</a>.</li>
      <li>In Google Auth Platform, set the app name, choose External, keep Testing, and add your Gmail address as a test user. Add the <code>gmail.readonly</code> scope under Data Access.</li>
      <li>Create a client of type <strong>Web application</strong>. Under Authorized JavaScript origins, add:<code className="origin">{window.location.origin}</code></li>
      <li>Paste the client ID below. You do not need an API key, client secret, or paid Apple account.</li>
    </ol>
    <form onSubmit={event => { event.preventDefault(); if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(value.trim())) { setError('Paste the complete web client ID ending in .apps.googleusercontent.com.'); return; } saveClientId(value); onSave(); }}>
      <label htmlFor="client-id">Google web client ID</label><input id="client-id" value={value} onChange={event => setValue(event.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" autoComplete="off" spellCheck={false}/>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="primary" type="submit">Save connection settings</button>
    </form>
    <p className="fine-print">The client ID is a public identifier, saved only in this browser. Access tokens stay in memory. Google grants read-only access to your mailbox; AI Signal fetches only _AI_SIGNAL.</p>
  </section></div>;
}
