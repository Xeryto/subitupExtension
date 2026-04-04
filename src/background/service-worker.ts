import { parseSubItUpResponse } from '../lib/shift-parser';
import { syncShifts, clearSyncedEvents } from '../lib/sync-engine';
import { Shift, UserInfo, AppleCredentials, CalendarProviderType, DEFAULT_SETTINGS } from '../lib/types';
import { GoogleProvider } from '../lib/google-provider';
import { AppleProvider } from '../lib/apple-provider';
import { CalendarProvider } from '../lib/calendar-provider';
const DISPLAY_SHIFTS_KEY = 'displayShifts';  // Latest view — replaced on each API response
const ALL_SHIFTS_KEY = 'allShifts';          // Accumulated — merged, never deleted
const TOKEN_KEY = 'authToken';
const APPLE_CREDS_KEY = 'appleCredentials';

let syncInProgress = false;

// --- Network interception ---
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'GET' && details.method !== 'POST') return;
    if (!details.url.match(/subitup\.com.*\/(schedule|shift|calendar|api)/i)) return;
    if (details.requestBody?.raw) {
      // Can't read response bodies from webRequest in MV3;
      // content script forwards fetched data instead
    }
  },
  { urls: ['https://*.subitup.com/*'] },
  ['requestBody']
);

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('Message handler error:', err);
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(message: { type: string; [key: string]: unknown }, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'INTERCEPTED_DATA': {
      const newShifts = parseSubItUpResponse(message.data);
      if (newShifts.length > 0) {
        // Display: replace with latest view
        await chrome.storage.local.set({ [DISPLAY_SHIFTS_KEY]: newShifts });
        updateBadge(newShifts.length);

        // Sync pool: merge (upsert by ID, never delete)
        const storage = await chrome.storage.local.get(ALL_SHIFTS_KEY);
        const existing: Shift[] = storage[ALL_SHIFTS_KEY] || [];
        const map = new Map(existing.map(s => [s.id, s]));
        for (const s of newShifts) {
          map.set(s.id, s);
        }
        await chrome.storage.local.set({ [ALL_SHIFTS_KEY]: Array.from(map.values()) });

        // Auto-sync if pending — use active provider
        if (autoSyncPending) {
          autoSyncPending = false;
          const s = await chrome.storage.local.get('settings');
          const p = { ...DEFAULT_SETTINGS, ...s.settings }.activeProvider;
          handleMessage({ type: 'SYNC_TO_CALENDAR', provider: p }, undefined).catch(() => {});
        }
      }
      return { success: true, count: newShifts.length };
    }

    case 'GET_SHIFTS': {
      const storage = await chrome.storage.local.get(DISPLAY_SHIFTS_KEY);
      return { shifts: storage[DISPLAY_SHIFTS_KEY] || [] };
    }

    case 'SYNC_TO_CALENDAR': {
      const providerType = (message.provider as string) || 'google';
      const storage = await chrome.storage.local.get(ALL_SHIFTS_KEY);
      const shifts: Shift[] = storage[ALL_SHIFTS_KEY] || [];
      if (shifts.length === 0) return { success: false, error: 'No shifts to sync' };
      return doSync(providerType as CalendarProviderType, shifts);
    }

    case 'SYNC_SELECTED': {
      const providerType = (message.provider as string) || 'google';
      const shifts = message.shifts as Shift[];
      if (!shifts || shifts.length === 0) return { success: false, error: 'No shifts selected' };

      // Merge selected shifts into accumulated pool
      const storage = await chrome.storage.local.get(ALL_SHIFTS_KEY);
      const existing: Shift[] = storage[ALL_SHIFTS_KEY] || [];
      const map = new Map(existing.map(s => [s.id, s]));
      for (const s of shifts) map.set(s.id, s);
      await chrome.storage.local.set({ [ALL_SHIFTS_KEY]: Array.from(map.values()) });

      return doSync(providerType as CalendarProviderType, shifts);
    }

    case 'GET_AUTH_TOKEN': {
      const token = await getAuthToken(true);
      if (!token) {
        return { token: null, error: (globalThis as any).__lastAuthError ?? 'Unknown auth error' };
      }
      return { token };
    }

    case 'GET_USER_INFO': {
      const token = await getAuthToken(false);
      if (!token) return { user: null };
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { user: null };
        const data = await res.json();
        const user: UserInfo = {
          email: data.email,
          name: data.name,
          picture: data.picture,
        };
        return { user };
      } catch {
        return { user: null };
      }
    }

    case 'SIGN_OUT': {
      const token = await getAuthToken(false);
      if (token) {
        chrome.identity.removeCachedAuthToken({ token });
        // Revoke the grant on Google's servers so getAuthToken prompts again
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' });
        } catch {}
      }
      await chrome.storage.local.remove([TOKEN_KEY, 'lastSyncedAt_google']);
      return { success: true };
    }

    case 'CLEAR_SYNCED_EVENTS': {
      const providerType = (message.provider as string) || 'google';
      try {
        const provider = await getProvider(providerType as CalendarProviderType);
        if (!provider) return { success: false, error: `${providerType} not authenticated` };
        const count = await clearSyncedEvents(provider);
        return { success: true, count };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'VALIDATE_APPLE_CREDENTIALS': {
      const creds = message.credentials as AppleCredentials;
      try {
        const { discoverCalendarHome } = await import('../lib/apple-caldav');
        await discoverCalendarHome(creds);
        await chrome.storage.local.set({ [APPLE_CREDS_KEY]: creds });
        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'AUTH_EXPIRED') return { success: false, error: 'Invalid credentials' };
        return { success: false, error: msg };
      }
    }

    case 'GET_APPLE_CREDENTIALS': {
      // Only respond to our own extension pages (popup/iframe), not content scripts or other extensions
      if (sender?.id !== chrome.runtime.id) return { credentials: null };
      const stored = await chrome.storage.local.get(APPLE_CREDS_KEY);
      return { credentials: stored[APPLE_CREDS_KEY] || null };
    }

    case 'DISCONNECT_APPLE': {
      await chrome.storage.local.remove([APPLE_CREDS_KEY, 'lastSyncedAt_apple']);
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// --- Provider factory ---

async function getProvider(type: CalendarProviderType): Promise<CalendarProvider | null> {
  if (type === 'google') {
    const token = await getAuthToken(false);
    if (!token) return null;
    return new GoogleProvider(token);
  }
  if (type === 'apple') {
    const stored = await chrome.storage.local.get(APPLE_CREDS_KEY);
    const creds = stored[APPLE_CREDS_KEY] as AppleCredentials | undefined;
    if (!creds) return null;
    return new AppleProvider(creds);
  }
  return null;
}

async function doSync(providerType: CalendarProviderType, shifts: Shift[]): Promise<unknown> {
  if (syncInProgress) return { success: false, error: 'Sync already in progress' };
  syncInProgress = true;
  try {
    const provider = await getProvider(providerType);
    if (!provider) return { success: false, error: `${providerType} not authenticated` };
    const result = await syncShifts(provider, shifts);
    updateBadgeColor('#22C55E');
    return { success: true, syncedCount: result.created + result.updated, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'AUTH_EXPIRED' && providerType === 'google') {
      // Retry with fresh Google token; partial records already saved by sync-engine
      await chrome.storage.local.remove(TOKEN_KEY);
      const token = await getAuthToken(false);
      if (token) {
        const provider = new GoogleProvider(token);
        const result = await syncShifts(provider, shifts);
        updateBadgeColor('#22C55E');
        return { success: true, syncedCount: result.created + result.updated, ...result };
      }
    }
    updateBadgeColor('#EF4444');
    const userMsg = msg === 'AUTH_EXPIRED' && providerType === 'apple'
      ? 'Apple credentials expired — reconnect in settings'
      : msg;
    return { success: false, error: userMsg };
  } finally {
    syncInProgress = false;
  }
}

// --- Auth ---

function getAuthToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message ?? 'Unknown auth error';
        console.error('Auth error:', msg);
        (globalThis as any).__lastAuthError = msg;
        resolve(null);
        return;
      }
      resolve(token ?? null);
    });
  });
}

function updateBadge(count: number) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0891B2' });
}

function updateBadgeColor(color: string) {
  chrome.action.setBadgeBackgroundColor({ color });
}

// Auto-sync: set flag on page load, trigger after first shift data arrives
let autoSyncPending = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SUBITUP_PAGE_LOADED') {
    chrome.storage.local.get('settings', (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...result.settings };
      if (settings.autoSync) {
        autoSyncPending = true;
      }
    });
  }
});
