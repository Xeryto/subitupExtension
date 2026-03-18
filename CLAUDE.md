# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Make atomic git commits after each logical change. Don't wait to be asked.

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

**Provider abstraction** (`src/lib/calendar-provider.ts`): `CalendarProvider` interface implemented by `GoogleProvider` (REST) and `AppleProvider` (CalDAV via `apple-caldav.ts`). `sync-engine.ts` is provider-agnostic — upserts events using a hash-based `SyncRecord` stored in `chrome.storage.local` under `syncRecords_<provider>`.

**Auth split**: Google uses `chrome.identity` (prod) or `launchWebAuthFlow` + token cache (dev/unpacked). Apple uses email + app-specific password stored in `chrome.storage.local` under `appleCredentials`.

**ICS export** (`src/lib/ics-export.ts`): generates and triggers download of `.ics` file for selected shifts — no provider needed.
