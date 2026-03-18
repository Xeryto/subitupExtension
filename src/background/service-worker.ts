import { parseSubItUpResponse } from '../lib/shift-parser';
import { syncShifts, clearSyncedEvents } from '../lib/sync-engine';
import { Shift, UserInfo, DEFAULT_SETTINGS } from '../lib/types';

const SHIFTS_KEY = 'capturedShifts';

// --- Network interception ---
// Listen for SubItUp API responses containing schedule/shift data
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== 'GET' && details.method !== 'POST') return;
    if (!details.url.match(/subitup\.com.*\/(schedule|shift|calendar|api)/i)) return;

    // For POST requests with a request body
    if (details.requestBody?.raw) {
      // We can't read response bodies from webRequest in MV3,
      // so we rely on the content script to forward fetched data
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
      const shifts = parseSubItUpResponse(message.data);
      if (shifts.length > 0) {
        await chrome.storage.local.set({ [SHIFTS_KEY]: shifts });
        updateBadge(shifts.length);
      }
      return { success: true, count: shifts.length };
    }

    case 'GET_SHIFTS': {
      const storage = await chrome.storage.local.get(SHIFTS_KEY);
      return { shifts: storage[SHIFTS_KEY] || [] };
    }

    case 'SYNC_TO_CALENDAR': {
      const token = await getAuthToken();
      if (!token) return { success: false, error: 'Not authenticated' };

      const storage = await chrome.storage.local.get(SHIFTS_KEY);
      const shifts: Shift[] = storage[SHIFTS_KEY] || [];
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
          // Try refreshing token
          chrome.identity.removeCachedAuthToken({ token });
          const newToken = await getAuthToken();
          if (newToken) {
            const storage2 = await chrome.storage.local.get(SHIFTS_KEY);
            const result = await syncShifts(newToken, storage2[SHIFTS_KEY] || []);
            return { success: true, syncedCount: result.created + result.updated, ...result };
          }
        }
        updateBadgeColor('#EF4444');
        return { success: false, error: msg };
      }
    }

    case 'GET_AUTH_TOKEN': {
      const token = await getAuthToken();
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
      }
      return { success: true };
    }

    case 'CLEAR_SYNCED_EVENTS': {
      const token = await getAuthToken();
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

async function getAuthToken(interactive: boolean = true): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.warn('Auth error:', chrome.runtime.lastError.message);
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

// Auto-sync on SubItUp page load (if enabled)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SUBITUP_PAGE_LOADED') {
    chrome.storage.local.get('settings', (result) => {
      const settings = { ...DEFAULT_SETTINGS, ...result.settings };
      if (settings.autoSync) {
        handleMessage({ type: 'SYNC_TO_CALENDAR' });
      }
    });
  }
});
