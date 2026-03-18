import { parseSubItUpResponse } from '../lib/shift-parser';
import { syncShifts, clearSyncedEvents } from '../lib/sync-engine';
import { Shift, UserInfo, DEFAULT_SETTINGS } from '../lib/types';

const DISPLAY_SHIFTS_KEY = 'displayShifts';  // Latest view — replaced on each API response
const ALL_SHIFTS_KEY = 'allShifts';          // Accumulated — merged, never deleted
const TOKEN_KEY = 'authToken';

// Dev (unpacked) uses launchWebAuthFlow; production uses getAuthToken
const isProduction = !!chrome.runtime.getManifest().update_url;

const WEB_CLIENT_ID = '429501987868-jfdub6uufsu8i5juo1atnnkn3us31mus.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => {
    console.error('Message handler error:', err);
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(message: { type: string; [key: string]: unknown }): Promise<unknown> {
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

        // Auto-sync if pending
        if (autoSyncPending) {
          autoSyncPending = false;
          handleMessage({ type: 'SYNC_TO_CALENDAR' });
        }
      }
      return { success: true, count: newShifts.length };
    }

    case 'GET_SHIFTS': {
      const storage = await chrome.storage.local.get(DISPLAY_SHIFTS_KEY);
      return { shifts: storage[DISPLAY_SHIFTS_KEY] || [] };
    }

    case 'SYNC_TO_CALENDAR': {
      const token = await getAuthToken(false);
      if (!token) return { success: false, error: 'Not authenticated' };

      // Sync from the accumulated pool, not just the current display
      const storage = await chrome.storage.local.get(ALL_SHIFTS_KEY);
      const shifts: Shift[] = storage[ALL_SHIFTS_KEY] || [];
      if (shifts.length === 0) return { success: false, error: 'No shifts to sync' };

      try {
        const result = await syncShifts(token, shifts);
        updateBadgeColor('#22C55E');
        return {
          success: true,
          syncedCount: result.created + result.updated,
          ...result,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === 'AUTH_EXPIRED') {
          // Clear stale token and retry silently
          await chrome.storage.local.remove(TOKEN_KEY);
          if (isProduction) {
            const staleToken = token;
            chrome.identity.removeCachedAuthToken({ token: staleToken });
          }
          const newToken = await getAuthToken(false);
          if (newToken) {
            const storage2 = await chrome.storage.local.get(ALL_SHIFTS_KEY);
            const result = await syncShifts(newToken, storage2[ALL_SHIFTS_KEY] || []);
            return { success: true, syncedCount: result.created + result.updated, ...result };
          }
        }
        updateBadgeColor('#EF4444');
        return { success: false, error: msg };
      }
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
        if (isProduction) {
          chrome.identity.removeCachedAuthToken({ token });
        }
        await chrome.storage.local.remove(TOKEN_KEY);
      }
      return { success: true };
    }

    case 'CLEAR_SYNCED_EVENTS': {
      const token = await getAuthToken(false);
      if (!token) return { success: false, error: 'Not authenticated' };
      try {
        const count = await clearSyncedEvents(token);
        return { success: true, count };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// --- Auth ---

async function getAuthToken(interactive: boolean): Promise<string | null> {
  if (isProduction) {
    return getAuthTokenProduction(interactive);
  }
  return getAuthTokenDev(interactive);
}

// Production: chrome.identity.getAuthToken (requires published extension)
function getAuthTokenProduction(interactive: boolean): Promise<string | null> {
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

// Dev: chrome.identity.launchWebAuthFlow (works with unpacked extensions)
async function getAuthTokenDev(interactive: boolean): Promise<string | null> {
  // Check for cached token first
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  if (stored[TOKEN_KEY]) {
    // Validate token is still good
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + stored[TOKEN_KEY]);
      if (res.ok) return stored[TOKEN_KEY];
    } catch {}
    // Token expired, clear it
    await chrome.storage.local.remove(TOKEN_KEY);
  }

  if (!interactive) return null;

  // Launch OAuth flow
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', WEB_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('prompt', 'consent');

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          const msg = chrome.runtime.lastError?.message ?? 'Auth flow cancelled';
          console.error('Auth error:', msg);
          (globalThis as any).__lastAuthError = msg;
          resolve(null);
          return;
        }

        // Extract access_token from redirect URL fragment
        const url = new URL(responseUrl);
        const params = new URLSearchParams(url.hash.substring(1));
        const token = params.get('access_token');

        if (token) {
          chrome.storage.local.set({ [TOKEN_KEY]: token });
          resolve(token);
        } else {
          console.error('No access_token in response:', responseUrl);
          (globalThis as any).__lastAuthError = 'No access token received';
          resolve(null);
        }
      }
    );
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
