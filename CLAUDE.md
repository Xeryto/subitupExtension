# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Make atomic git commits after each logical change. Don't wait to be asked.
- After any change that touches behavior described in README.md or CLAUDE.md (architecture, auth, storage keys, sync flow, security model), update those docs to match before committing.

## Commands

```bash
npm run build        # production build → dist/
npm run dev          # watch mode (development)
npm run test         # all tests
npx jest src/__tests__/shift-parser.test.ts  # single test file
```

Load the extension in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Architecture

**Chrome extension (Manifest V3)** with four layers:

1. **`src/content/interceptor.ts`** — runs in MAIN world, monkey-patches `XMLHttpRequest`/`fetch` on subitup.com to capture schedule API responses, posts them via `window.postMessage`.

2. **`src/content/content-script.ts`** — isolated world; relays intercepted data to service worker via `chrome.runtime.sendMessage`. Also injects a floating action button (FAB) that renders `popup.html` in an iframe panel.

3. **`src/background/service-worker.ts`** — central message hub. Handles auth (Google OAuth via `launchWebAuthFlow` in dev, `getAuthToken` in prod), parses shifts, manages two storage keys (`displayShifts` = latest view, `allShifts` = accumulated merge pool), delegates sync to provider.

4. **`src/popup/`** — React 18 UI (`Popup.tsx` + components). Communicates exclusively via `chrome.runtime.sendMessage` to the service worker.

**Provider abstraction** (`src/lib/calendar-provider.ts`): `CalendarProvider` interface implemented by `GoogleProvider` (REST) and `AppleProvider` (CalDAV via `apple-caldav.ts`). `sync-engine.ts` is provider-agnostic — uses the calendar as source of truth. Each event stores a `subitupShiftId` and `subitupHash` (Google: `extendedProperties.private`; Apple: UID prefix + `X-SUBITUP-HASH`). On sync, `listSyncedEvents` fetches all events from the calendar, compares hashes, and creates/updates only what changed. No local `SyncRecord` storage — survives extension reinstall.

**Auth split**: Google uses `chrome.identity` (prod) or `launchWebAuthFlow` + token cache (dev/unpacked). Apple uses email + app-specific password stored in `chrome.storage.local` under `appleCredentials`.

**ICS export** (`src/lib/ics-export.ts`): generates and triggers download of `.ics` file for selected shifts — no provider needed.
