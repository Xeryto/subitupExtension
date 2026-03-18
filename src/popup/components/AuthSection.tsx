import React from 'react';
import { UserInfo } from '../../lib/types';
import { LogIn, LogOut, User } from 'lucide-react';

interface Props {
  user: UserInfo | null;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthSection({ user, loading, onSignIn, onSignOut }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-primary/20 rounded animate-pulse w-32" />
          <div className="h-2 bg-primary/10 rounded animate-pulse w-24" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 py-3">
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm cursor-pointer transition-colors duration-150 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-bg"
        >
          <LogIn size={18} />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {user.picture ? (
        <img
          src={user.picture}
          alt=""
          className="w-10 h-10 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <User size={20} className="text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text truncate">{user.name}</p>
        <p className="text-xs text-text/60 truncate">{user.email}</p>
      </div>
      <button
        onClick={onSignOut}
        className="p-1.5 text-text/40 hover:text-text/70 cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded"
        aria-label="Sign out"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}
