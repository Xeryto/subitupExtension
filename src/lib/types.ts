export interface Shift {
  id: string;
  title: string;
  location?: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

export interface SyncRecord {
  shiftId: string;
  calendarEventId: string;
  lastSyncedAt: string;
  hash: string;
}

export interface Settings {
  dateRange: 'week' | '2weeks' | 'month';
  autoSync: boolean;
  timezone: string;
}

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface AppState {
  user: UserInfo | null;
  shifts: Shift[];
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  settings: Settings;
}

// Message types between popup <-> service worker
export type Message =
  | { type: 'GET_SHIFTS' }
  | { type: 'SHIFTS_UPDATED'; shifts: Shift[] }
  | { type: 'SYNC_TO_CALENDAR' }
  | { type: 'SYNC_RESULT'; success: boolean; error?: string; syncedCount?: number }
  | { type: 'GET_AUTH_TOKEN' }
  | { type: 'AUTH_TOKEN'; token: string | null }
  | { type: 'SIGN_OUT' }
  | { type: 'GET_USER_INFO' }
  | { type: 'USER_INFO'; user: UserInfo | null }
  | { type: 'CLEAR_SYNCED_EVENTS' }
  | { type: 'CLEAR_RESULT'; success: boolean; error?: string };

export const DEFAULT_SETTINGS: Settings = {
  dateRange: '2weeks',
  autoSync: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
