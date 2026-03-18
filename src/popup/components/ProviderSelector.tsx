import React from 'react';
import { CalendarProviderType } from '../../lib/types';

interface Props {
  active: CalendarProviderType;
  onChange: (provider: CalendarProviderType) => void;
}

export function ProviderSelector({ active, onChange }: Props) {
  return (
    <div className="flex mx-4 mt-2 mb-1 p-0.5 bg-text/5 rounded-lg">
      <button
        onClick={() => onChange('google')}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer focus:outline-none ${
          active === 'google'
            ? 'bg-white text-text shadow-sm'
            : 'text-text/40 hover:text-text/60'
        }`}
      >
        Google
      </button>
      <button
        onClick={() => onChange('apple')}
        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer focus:outline-none ${
          active === 'apple'
            ? 'bg-white text-text shadow-sm'
            : 'text-text/40 hover:text-text/60'
        }`}
      >
        Apple
      </button>
    </div>
  );
}
