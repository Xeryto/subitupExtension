# SubItUp Sync

A Chrome extension that automatically detects your SubItUp work schedule and syncs it to Google Calendar or Apple Calendar — no copy-pasting required.

---

## What it does

When you open your SubItUp schedule, the extension detects your shifts in the background. You pick which shifts to sync, click one button, and they appear in your calendar with the correct times, titles, and locations.

---

## Installation

> SubItUp Sync is not yet on the Chrome Web Store. Install it manually:

1. Download or clone this repository
2. Run `npm install && npm run build` (requires Node.js)
3. Open Chrome and go to `chrome://extensions`
4. Turn on **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the `dist/` folder
6. The SubItUp Sync icon will appear in your Chrome toolbar

---

## Setup

### Google Calendar

1. Open the extension popup (click the icon in your toolbar, or click the floating button on any SubItUp page)
2. Make sure **Google** is selected at the top
3. Click **Sign in with Google**
4. Approve the calendar permission — the extension only requests access to create and manage its own "SubItUp Shifts" calendar

### Apple Calendar (iCloud)

1. Select **Apple** at the top of the popup
2. You need an **app-specific password** — your regular Apple ID password won't work here
   - Go to [appleid.apple.com](https://appleid.apple.com/account/manage) → Sign In and Security → App-Specific Passwords
   - Click the **+** button, give it a name like "SubItUp Sync", and copy the generated password
3. Enter your Apple ID email and the app-specific password, then click **Connect Apple Calendar**
4. The extension will validate your credentials by connecting to iCloud CalDAV

---

## How to use

1. **Navigate to your SubItUp schedule** — the extension automatically reads your shifts as the page loads
2. **Open the popup** — click the toolbar icon or the floating calendar button on the page
3. **Select shifts** — all shifts are checked by default; uncheck any you don't want to sync
4. **Click Sync** — your shifts are added to a calendar called "SubItUp Shifts" in your Google or Apple Calendar

### Download as .ics

If you'd rather import shifts manually (or use a calendar app that doesn't support CalDAV):

- Select the shifts you want, then click **Download .ics file**
- Open the downloaded file with any calendar app (Calendar.app, Outlook, Thunderbird, etc.)
- No account connection required

### Auto-sync

In **Settings** (bottom of the popup), you can enable **Auto-sync on page load**. When active, the extension will automatically sync your shifts to your calendar every time you open your SubItUp schedule — no button click needed.

---

## Switching between Google and Apple

Use the **Google / Apple** toggle at the top of the popup. Each provider has its own sync history and records — switching providers won't affect your other calendar's synced events.

---

## Settings

| Setting | What it does |
|---|---|
| Auto-sync on page load | Automatically syncs shifts whenever you open SubItUp |
| Timezone | Shows your detected local timezone (used for .ics exports and Apple sync) |
| Clear synced events | Removes all events the extension created in your calendar and resets sync history |

---

## Troubleshooting

**No shifts appear in the popup**
- Make sure you're on a SubItUp page with your schedule loaded
- Try navigating to a different week and back — the extension reads shifts as the page loads

**Google: "Auth failed" error**
- Sign out and sign back in — your token may have expired
- Make sure you approved calendar permissions during sign-in

**Apple: "Invalid credentials" or "AUTH_EXPIRED"**
- App-specific passwords can be revoked at appleid.apple.com — generate a new one and reconnect
- Make sure you're using an app-specific password, not your regular Apple ID password

**Events appear at the wrong time**
- Check that your timezone in Settings matches your local timezone

**Sync succeeded but events don't appear in calendar**
- For Google: check your calendar list for a calendar named "SubItUp Shifts"
- For Apple: iCloud can take a minute or two to sync to your devices

---

## Permissions explained

| Permission | Why it's needed |
|---|---|
| `identity` | Signs you in to Google using Chrome's built-in OAuth |
| `storage` | Saves your settings, shift data, and sync history locally on your device |
| `webRequest` | Monitors SubItUp page loads to detect when new schedule data is available |
| `https://*.subitup.com/*` | Reads your schedule data from SubItUp pages |
| `https://www.googleapis.com/*` | Creates and manages events in Google Calendar |
| `https://caldav.icloud.com/*` | Creates and manages events in Apple Calendar via iCloud |

---

## Privacy

This extension processes your data entirely on your device. See [PRIVACY.md](PRIVACY.md) for full details.

---

## Development

```bash
npm install          # install dependencies
npm run build        # production build → dist/
npm run dev          # watch mode (rebuilds on save)
npm test             # run tests
```

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`
