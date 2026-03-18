import React, { useState } from 'react';
import { AppleCredentials } from '../../lib/types';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

interface Props {
  credentials: AppleCredentials | null;
  onConnect: (creds: AppleCredentials) => void;
  onDisconnect: () => void;
  loading: boolean;
  error: string | null;
}

export function AppleAuth({ credentials, onConnect, onDisconnect, loading, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center px-4 py-3">
        <Loader2 size={20} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-text/60">Validating...</span>
      </div>
    );
  }

  if (credentials) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-text/10 flex items-center justify-center text-lg">

        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">Apple Calendar</p>
          <p className="text-xs text-text/60 truncate">{credentials.email}</p>
        </div>
        <button
          onClick={onDisconnect}
          className="p-1.5 text-text/40 hover:text-text/70 cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
          aria-label="Disconnect"
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    onConnect({ email, appSpecificPassword: password });
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 space-y-2">
      <input
        type="email"
        placeholder="Apple ID email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-primary/20 rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
        required
      />
      <input
        type="password"
        placeholder="App-specific password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-primary/20 rounded-lg bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
        required
      />
      <p className="text-[10px] text-text/40">
        Generate at{' '}
        <a
          href="https://appleid.apple.com/account/manage"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          appleid.apple.com
        </a>
        {' '}→ App-Specific Passwords
      </p>
      {error && <p className="text-xs text-error">{error}</p>}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm cursor-pointer transition-colors duration-150 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-bg"
      >
        <LogIn size={18} />
        Connect Apple Calendar
      </button>
    </form>
  );
}
