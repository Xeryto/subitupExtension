// Copy this file to src/config.ts and fill in your own values.
// src/config.ts is gitignored — never commit it.
//
// This file is only needed for dev/unpacked installs. Published installs use
// chrome.identity.getAuthToken() with the Chrome App client ID in manifest.json
// and do not need a WEB_CLIENT_ID.
//
// To get a WEB_CLIENT_ID for dev:
// 1. Go to console.cloud.google.com → APIs & Services → Credentials
// 2. Create an OAuth 2.0 Client ID → Application type: Web application
// 3. Add your extension's redirect URI to "Authorized redirect URIs":
//    chrome-extension://<YOUR_EXTENSION_ID>/
//    (find your extension ID at chrome://extensions after loading unpacked)

export const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
