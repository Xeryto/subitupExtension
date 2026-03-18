import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Shift, UserInfo, Settings, SyncStatus, DEFAULT_SETTINGS } from '../lib/types';
import { formatDateRange } from '../utils/date';
import { generateIcsBlob } from '../lib/ics-export';
import { useChromeStorage } from './hooks/useChromeStorage';
import { AuthSection } from './components/AuthSection';
import { ShiftList } from './components/ShiftList';
import { SyncButton } from './components/SyncButton';
import { StatusBar } from './components/StatusBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Calendar, Download } from 'lucide-react';

export function Popup() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useChromeStorage<string | null>('lastSyncedAt_google', null);
  const [settings, setSettings] = useChromeStorage<Settings>('settings', DEFAULT_SETTINGS);
  const [clearing, setClearing] = useState(false);

  // Load user info
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_USER_INFO' }, (res) => {
      setUser(res?.user ?? null);
      setAuthLoading(false);
    });
  }, []);

  // Load shifts
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SHIFTS' }, (res) => {
      const s = res?.shifts ?? [];
      setShifts(s);
      setSelectedIds(new Set(s.map((shift: Shift) => shift.id)));
      setShiftsLoading(false);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.displayShifts) {
        const s = changes.displayShifts.newValue ?? [];
        setShifts(s);
        setSelectedIds(new Set(s.map((shift: Shift) => shift.id)));
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const handleToggleShift = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === shifts.length) return new Set();
      return new Set(shifts.map(s => s.id));
    });
  }, [shifts]);

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === shifts.length && shifts.length > 0;

  const handleSignIn = useCallback(() => {
    setAuthLoading(true);
    setSyncError(null);
    chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' }, (res) => {
      if (res?.error) {
        setSyncError(`Auth failed: ${res.error}`);
        setSyncStatus('error');
        setAuthLoading(false);
        return;
      }
      chrome.runtime.sendMessage({ type: 'GET_USER_INFO' }, (res) => {
        setUser(res?.user ?? null);
        setAuthLoading(false);
      });
    });
  }, []);

  const handleSignOut = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => {
      setUser(null);
    });
  }, []);

  const handleSync = useCallback(() => {
    const selected = shifts.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return;

    setSyncStatus('syncing');
    setSyncError(null);
    chrome.runtime.sendMessage({ type: 'SYNC_SELECTED', shifts: selected }, (res) => {
      if (res?.success) {
        setSyncStatus('success');
        setLastSyncedAt(new Date().toISOString());
      } else {
        setSyncStatus('error');
        setSyncError(res?.error ?? 'Sync failed');
      }
    });
  }, [shifts, selectedIds, setLastSyncedAt]);

  const handleClearEvents = useCallback(() => {
    setClearing(true);
    chrome.runtime.sendMessage({ type: 'CLEAR_SYNCED_EVENTS' }, (res) => {
      setClearing(false);
      if (!res?.success) {
        setSyncError(res?.error ?? 'Failed to clear events');
        setSyncStatus('error');
      }
    });
  }, []);

  const handleDownloadIcs = useCallback(() => {
    const selected = shifts.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return;
    const blob = generateIcsBlob(selected, settings.timezone);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subitup-shifts.ics';
    a.click();
    URL.revokeObjectURL(url);
  }, [shifts, selectedIds, settings.timezone]);

  const syncDisabled = !user || selectedCount === 0 || syncStatus === 'syncing';

  return (
    <div className="flex flex-col h-full min-h-[500px] bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          <h1 className="text-base font-bold text-text">SubItUp Sync</h1>
        </div>
      </header>

      {/* Auth */}
      <AuthSection
        user={user}
        loading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <div className="border-t border-primary/10" />

      {/* Shift summary + select all */}
      {shifts.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2">
          <button
            onClick={handleToggleAll}
            className="flex items-center justify-center w-4 h-4 rounded border cursor-pointer transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{
              borderColor: allSelected ? '#0891B2' : '#164E6340',
              backgroundColor: allSelected ? '#0891B2' : 'transparent',
            }}
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
          >
            {allSelected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1.5,5 4,7.5 8.5,2.5" />
              </svg>
            )}
          </button>
          <Calendar size={16} className="text-primary" />
          <p className="text-sm font-medium text-text">
            {selectedCount}/{shifts.length} shift{shifts.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-text/40 ml-auto">{formatDateRange(shifts)}</p>
        </div>
      )}

      {/* Shift list — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <ShiftList
          shifts={shifts}
          loading={shiftsLoading}
          selectedIds={selectedIds}
          onToggle={handleToggleShift}
        />
      </div>

      {/* Sync button */}
      <SyncButton
        status={syncStatus}
        disabled={syncDisabled}
        onSync={handleSync}
        count={selectedCount}
      />

      {/* ICS download */}
      {shifts.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={handleDownloadIcs}
            disabled={selectedCount === 0}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Download .ics file
          </button>
        </div>
      )}

      {/* Status bar */}
      <StatusBar status={syncStatus} lastSyncedAt={lastSyncedAt} error={syncError} />

      {/* Settings */}
      <SettingsPanel
        settings={settings}
        onUpdate={setSettings}
        onClearEvents={handleClearEvents}
        clearing={clearing}
      />
    </div>
  );
}
