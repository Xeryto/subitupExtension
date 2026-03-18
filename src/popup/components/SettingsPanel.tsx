import React, { useState } from 'react';
import { Settings } from '../../lib/types';
import { ChevronDown, ChevronUp, Trash2, Globe, Zap } from 'lucide-react';

interface Props {
  settings: Settings;
  onUpdate: (settings: Settings) => void;
  onClearEvents: () => void;
  clearing: boolean;
}

export function SettingsPanel({ settings, onUpdate, onClearEvents, clearing }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-primary/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-text/50 cursor-pointer hover:text-text/70 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
        aria-expanded={open}
        aria-label="Toggle settings"
      >
        Settings
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {/* Auto-sync */}
          <div className="flex items-center justify-between">
            <label htmlFor="auto-sync" className="flex items-center gap-1.5 text-xs text-text/60">
              <Zap size={14} />
              Auto-sync on page load
            </label>
            <button
              id="auto-sync"
              role="switch"
              aria-checked={settings.autoSync}
              onClick={() => onUpdate({ ...settings, autoSync: !settings.autoSync })}
              className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                settings.autoSync ? 'bg-cta' : 'bg-text/20'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-150 ${
                  settings.autoSync ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>

          {/* Timezone */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-text/60">
              <Globe size={14} />
              Timezone
            </label>
            <p className="text-xs text-text/40">{settings.timezone}</p>
          </div>

          {/* Clear events */}
          <button
            onClick={onClearEvents}
            disabled={clearing}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-error/80 border border-error/20 rounded-lg cursor-pointer hover:bg-error/5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-error/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {clearing ? 'Clearing...' : 'Clear synced events'}
          </button>
        </div>
      )}
    </div>
  );
}
