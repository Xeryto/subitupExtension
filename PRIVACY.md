# Privacy Policy — SubItUp Sync

**Last updated: March 2026**

---

## Summary

SubItUp Sync is a browser extension that syncs your work schedule from SubItUp to your personal calendar. It does not have a backend server, does not create accounts, and does not transmit your data to anyone other than Google or Apple (depending on which calendar you connect).

---

## What data is collected

The extension reads and processes the following data:

**Shift data** — your shift titles, dates, times, and work locations, as returned by the SubItUp website when you view your schedule. This data comes from SubItUp's own API and is only ever sent to Google Calendar or Apple Calendar on your behalf.

**Google account information** — if you connect Google Calendar, the extension reads your name, email address, and profile picture from Google's API to display in the popup. This information is not stored beyond your active browser session.

**Apple ID email** — if you connect Apple Calendar, your Apple ID email address is stored locally on your device so the extension can identify your iCloud calendar. It is never sent anywhere except to Apple's CalDAV servers.

**Apple app-specific password** — stored locally on your device in Chrome's local storage. It is sent only to `caldav.icloud.com` to authenticate calendar requests. It is never logged, transmitted elsewhere, or shared.

---

## Where data is stored

All data is stored **locally on your device** using Chrome's built-in `chrome.storage.local` API. This includes:

- Your detected shifts (current view and accumulated sync pool)
- Your sync history (which shifts have been synced and their calendar event IDs)
- Your settings (timezone, auto-sync preference, active provider)
- Your Apple credentials (if connected)
- Your Google OAuth token (if connected)

None of this data is stored on any external server operated by this extension.

---

## How data is used

| Data | Used for |
|---|---|
| Shift titles, times, locations | Creating and updating calendar events in Google Calendar or Apple Calendar |
| Google OAuth token | Authenticating requests to Google Calendar API |
| Apple ID email + app-specific password | Authenticating requests to Apple iCloud CalDAV |
| Sync records | Detecting which events to create, update, or skip on the next sync |
| Settings | Respecting your timezone and auto-sync preferences |

---

## Third-party services

The extension communicates with the following services, and only these:

**SubItUp** (`subitup.com`) — the extension reads your schedule data from SubItUp pages. It does not send anything to SubItUp.

**Google Calendar API** (`googleapis.com`) — if you connect Google Calendar, your shift data is sent to Google to create calendar events. This is subject to [Google's Privacy Policy](https://policies.google.com/privacy).

**Apple iCloud CalDAV** (`caldav.icloud.com`) — if you connect Apple Calendar, your shift data is sent to Apple to create calendar events. This is subject to [Apple's Privacy Policy](https://www.apple.com/legal/privacy/).

The extension does **not** communicate with any other servers.

---

## Data sharing

This extension does not sell, share, or transmit your data to any third party other than Google or Apple as described above.

---

## Data retention and deletion

**Shifts and sync records** are stored locally and persist until you use "Clear synced events" in Settings, or uninstall the extension.

**Apple credentials** are deleted when you click "Disconnect" in the Apple auth section, or when you use "Clear synced events" for the Apple provider.

**Google credentials** are cleared when you sign out. In production (Chrome Web Store) mode, the OAuth token is managed by Chrome and is cleared automatically when you sign out.

You can remove all locally stored data at any time by uninstalling the extension.

---

## Permissions

The extension requests the minimum permissions needed to function:

- **identity** — used exclusively to sign in with Google via Chrome's OAuth flow
- **storage** — stores data locally on your device only
- **webRequest** — detects when SubItUp pages load so shifts can be read; does not modify any requests

---

## Contact

This is an open-source personal project. For questions or concerns, open an issue in the project repository.
