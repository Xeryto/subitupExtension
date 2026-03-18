import React from 'react';
import { SyncStatus } from '../../lib/types';
import { Check, X, Clock } from 'lucide-react';

interface Props {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
}

export function StatusBar({ status, lastSyncedAt, error }: Props) {
  if (status === 'error' && error) {
    return (
      <div className="px-4 py-2 flex items-center gap-2 text-error">
        <X size={14} />
        <p className="text-xs truncate">{error}</p>
      </div>
    );
  }

  if (!lastSyncedAt && status === 'idle') {
    return null;
  }

  const timeAgo = lastSyncedAt ? getTimeAgo(lastSyncedAt) : '';

  return (
    <div className="px-4 py-2 flex items-center gap-2 text-text/40">
      {status === 'success' ? (
        <Check size={14} className="text-cta" />
      ) : (
        <Clock size={14} />
      )}
      <p className="text-xs">
        {lastSyncedAt ? `Last synced: ${timeAgo}` : ''}
      </p>
    </div>
  );
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
