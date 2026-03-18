import React from 'react';
import { RefreshCw, CalendarCheck } from 'lucide-react';
import { SyncStatus } from '../../lib/types';

interface Props {
  status: SyncStatus;
  disabled: boolean;
  onSync: () => void;
  count: number;
}

export function SyncButton({ status, disabled, onSync, count }: Props) {
  const syncing = status === 'syncing';

  return (
    <div className="px-4 py-2">
      <button
        onClick={onSync}
        disabled={disabled || syncing}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg ${
          disabled
            ? 'bg-text/10 text-text/30 cursor-not-allowed'
            : syncing
            ? 'bg-primary/80 text-white cursor-wait'
            : 'bg-cta text-white hover:bg-cta/90 focus:ring-cta/50'
        }`}
      >
        {syncing ? (
          <>
            <RefreshCw size={18} className="animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <CalendarCheck size={18} />
            Sync {count} shift{count !== 1 ? 's' : ''} to Calendar
          </>
        )}
      </button>
    </div>
  );
}
