# SubItUp Sync

A Chrome extension that syncs your SubItUp work schedule to Google Calendar or Apple Calendar — no copy-pasting required.

---

## Install

[SubItUp Sync on the Chrome Web Store](https://chrome.google.com/webstore/detail/subitup-sync) — install and you're ready to set up.

---

## Setup

### Google Calendar

1. Open the extension popup (click the toolbar icon, or the floating button on any SubItUp page)
2. Make sure **Google** is selected at the top
3. Click **Sign in with Google**
4. Approve the calendar permission — the extension only requests access to create and manage its own "SubItUp Shifts" calendar

### Apple Calendar (iCloud)

1. Select **Apple** at the top of the popup
2. You need an **app-specific password** — your regular Apple ID password won't work here
   - Go to [appleid.apple.com](https://appleid.apple.com/account/manage) → Sign In and Security → App-Specific Passwords
   - Click the **+** button, give it a name like "SubItUp Sync", and copy the generated password
3. Enter your Apple ID email and the app-specific password, then click **Connect Apple Calendar**
4. The extension validates your credentials by connecting to iCloud CalDAV

---

## Usage

1. **Navigate to your SubItUp schedule** — the extension reads your shifts as the page loads
2. **Open the popup** — click the toolbar icon or the floating calendar button
3. **Select shifts** — all shifts are checked by default; uncheck any you don't want
4. **Click Sync** — shifts are added to a calendar called "SubItUp Shifts"

### Download as .ics

Select the shifts you want, then click **Download .ics file**. Open the downloaded file with any calendar app (Calendar.app, Outlook, Thunderbird, etc.). No account connection required.

### Auto-sync

In **Settings** (bottom of the popup), enable **Auto-sync on page load** to automatically sync every time you open your SubItUp schedule.

---

## Settings

| Setting | What it does |
|---|---|
| Auto-sync on page load | Automatically syncs shifts whenever you open SubItUp |
| Timezone | Your detected local timezone (used for .ics exports and Apple sync) |
| Clear synced events | Removes all events the extension created and resets sync history |

---

## Troubleshooting

**No shifts appear in the popup**
- Make sure you're on a SubItUp page with your schedule loaded
- Try navigating to a different week and back

**Google: "Auth failed" error**
- Sign out and sign back in — your token may have expired
- Make sure you approved calendar permissions during sign-in

**Apple: "Invalid credentials" or "AUTH_EXPIRED"**
- App-specific passwords can be revoked at appleid.apple.com — generate a new one and reconnect
- Make sure you're using an app-specific password, not your regular Apple ID password

**Events appear at the wrong time**
- Check that your timezone in Settings matches your local timezone

**Sync succeeded but events don't appear**
- For Google: check your calendar list for "SubItUp Shifts"
- For Apple: iCloud can take a minute or two to propagate to devices

---

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `identity` | Signs you in to Google using Chrome's built-in OAuth |
| `storage` | Saves settings, shift data, and sync history locally on your device |
| `webRequest` | Monitors SubItUp page loads to detect when new schedule data is available |
| `https://*.subitup.com/*` | Reads your schedule data from SubItUp pages |
| `https://www.googleapis.com/*` | Creates and manages events in Google Calendar |
| `https://caldav.icloud.com/*` | Creates and manages events in Apple Calendar via iCloud |

---

## Privacy

This extension processes your data entirely on your device. See [PRIVACY.md](PRIVACY.md) for full details.

---

## Development

### Prerequisites

- Node.js (v18+)

### Dev setup

1. Clone this repo
2. `npm install && npm run build`
3. Copy `manifest.example.json` → `manifest.json`, fill in your Chrome OAuth client ID
4. Copy `src/config.example.ts` → `src/config.ts`, fill in your Web OAuth client ID
5. Open `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

### Google OAuth setup (dev)

The extension uses two separate OAuth client IDs from the same GCP project:

- **Published extension** — uses `chrome.identity.getAuthToken()` with the **Chrome App** client ID in `manifest.json`. Chrome manages the token silently; no redirect URI needed.
- **Dev/unpacked** — uses `chrome.identity.launchWebAuthFlow()` with a **Web Application** client ID in `src/config.ts`. Requires a redirect URI (`chrome-extension://<YOUR_EXTENSION_ID>/`) added in GCP Console.

Detection: `chrome.runtime.getManifest().update_url` is present only in published installs. The service worker uses this to pick the right flow automatically.

To set up both:
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create a **Chrome App** OAuth client → paste its client ID into `manifest.json`
3. Create a **Web application** OAuth client → add `chrome-extension://<YOUR_EXTENSION_ID>/` as an authorized redirect URI → paste its client ID into `src/config.ts`

### Commands

```bash
npm run build    # production build → dist/
npm run dev      # watch mode
npm test         # run tests
```
