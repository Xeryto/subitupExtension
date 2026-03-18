import React, { useEffect, useState, useCallback } from 'react';
import { Shift, UserInfo, Settings, SyncStatus, DEFAULT_SETTINGS } from '../lib/types';
import { formatDateRange } from '../utils/date';
import { useChromeStorage } from './hooks/useChromeStorage';
import { AuthSection } from './components/AuthSection';
import { ShiftList } from './components/ShiftList';
import { SyncButton } from './components/SyncButton';
import { StatusBar } from './components/StatusBar';
import { SettingsPanel } from './components/SettingsPanel';
import { Calendar, Settings as SettingsIcon } from 'lucide-react';

export function Popup() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useChromeStorage<string | null>('lastSyncedAt', null);
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
      setShifts(res?.shifts ?? []);
      setShiftsLoading(false);
    });

    // Live-update when shifts change in storage
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.capturedShifts) {
        setShifts(changes.capturedShifts.newValue ?? []);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

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
    setSyncStatus('syncing');
    setSyncError(null);
    chrome.runtime.sendMessage({ type: 'SYNC_TO_CALENDAR' }, (res) => {
      if (res?.success) {
        setSyncStatus('success');
        setLastSyncedAt(new Date().toISOString());
      } else {
        setSyncStatus('error');
        setSyncError(res?.error ?? 'Sync failed');
      }
    });
  }, [setLastSyncedAt]);

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

  const syncDisabled = !user || shifts.length === 0 || syncStatus === 'syncing';

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

      {/* Shift summary */}
      {shifts.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <p className="text-sm font-medium text-text">
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} found
          </p>
          <p className="text-xs text-text/40 ml-auto">{formatDateRange(shifts)}</p>
        </div>
      )}

      {/* Shift list — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <ShiftList shifts={shifts} loading={shiftsLoading} />
      </div>

      {/* Sync button */}
      <SyncButton status={syncStatus} disabled={syncDisabled} onSync={handleSync} />

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
