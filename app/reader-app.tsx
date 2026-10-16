'use client';
import { useEffect, useState } from 'react';
import App from '../src/App';
export default function ReaderApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted ? <App/> : <p className="loading">Opening AI Signal…</p>;
}
