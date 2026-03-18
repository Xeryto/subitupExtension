export interface AppleCredentials {
  email: string;
  appSpecificPassword: string;
}

function authHeader(creds: AppleCredentials): string {
  return 'Basic ' + btoa(`${creds.email}:${creds.appSpecificPassword}`);
}

async function caldavRequest(
  url: string,
  method: string,
  creds: AppleCredentials,
  body?: string,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: authHeader(creds),
    ...extraHeaders,
  };
  if (body) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  }
  const res = await fetch(url, { method, headers, body });
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  return res;
}

// Discover principal URL and calendar home
export async function discoverCalendarHome(creds: AppleCredentials): Promise<string> {
  // Step 1: Find principal URL
  const principalRes = await caldavRequest(
    'https://caldav.icloud.com/',
    'PROPFIND',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`,
    { Depth: '0' }
  );
  if (!principalRes.ok) throw new Error(`CalDAV discovery failed: ${principalRes.status}`);
  const principalXml = await principalRes.text();
  const principalUrl = extractHref(principalXml, 'current-user-principal');
  if (!principalUrl) throw new Error('Could not find CalDAV principal URL');

  // Step 2: Find calendar home set
  const homeBase = principalUrl.startsWith('http') ? principalUrl : `https://caldav.icloud.com${principalUrl}`;
  const homeRes = await caldavRequest(
    homeBase,
    'PROPFIND',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`,
    { Depth: '0' }
  );
  if (!homeRes.ok) throw new Error(`CalDAV home discovery failed: ${homeRes.status}`);
  const homeXml = await homeRes.text();
  const homeUrl = extractHref(homeXml, 'calendar-home-set');
  if (!homeUrl) throw new Error('Could not find calendar home set');

  return homeUrl.startsWith('http') ? homeUrl : `https://caldav.icloud.com${homeUrl}`;
}

// Find existing calendar by name or create new one
export async function getOrCreateCalendar(
  creds: AppleCredentials,
  homeUrl: string,
  calendarName: string
): Promise<string> {
  // List calendars
  const listRes = await caldavRequest(
    homeUrl,
    'PROPFIND',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
    { Depth: '1' }
  );
  if (!listRes.ok) throw new Error(`CalDAV list calendars failed: ${listRes.status}`);
  const listXml = await listRes.text();

  // Parse responses to find matching calendar
  const existing = findCalendarByName(listXml, calendarName);
  if (existing) {
    return existing.startsWith('http') ? existing : `https://caldav.icloud.com${existing}`;
  }

  // Create new calendar
  const calPath = `${homeUrl.replace(/\/$/, '')}/subitup-shifts/`;
  const mkRes = await caldavRequest(
    calPath,
    'MKCALENDAR',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:set>
    <d:prop>
      <d:displayname>${calendarName}</d:displayname>
      <c:calendar-description>Shifts synced from SubItUp</c:calendar-description>
    </d:prop>
  </d:set>
</c:mkcalendar>`
  );
  if (!mkRes.ok && mkRes.status !== 201) {
    throw new Error(`CalDAV create calendar failed: ${mkRes.status}`);
  }
  return calPath;
}

// PUT an iCalendar event
export async function putEvent(
  creds: AppleCredentials,
  calendarUrl: string,
  uid: string,
  icalData: string,
  etag?: string
): Promise<string | undefined> {
  const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
  const headers: Record<string, string> = {
    'Content-Type': 'text/calendar; charset=utf-8',
  };
  if (etag) {
    headers['If-Match'] = etag;
  }
  const res = await caldavRequest(eventUrl, 'PUT', creds, icalData, headers);
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`CalDAV PUT event failed: ${res.status}`);
  }
  return res.headers.get('ETag') || undefined;
}

// DELETE an event
export async function deleteEvent(
  creds: AppleCredentials,
  calendarUrl: string,
  uid: string
): Promise<void> {
  const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
  const res = await caldavRequest(eventUrl, 'DELETE', creds);
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    throw new Error(`CalDAV DELETE event failed: ${res.status}`);
  }
}

// Check if event exists
export async function eventExists(
  creds: AppleCredentials,
  calendarUrl: string,
  uid: string
): Promise<boolean> {
  const eventUrl = `${calendarUrl.replace(/\/$/, '')}/${uid}.ics`;
  try {
    const res = await caldavRequest(eventUrl, 'HEAD', creds);
    return res.ok;
  } catch {
    return false;
  }
}

// List all event UIDs in a calendar (for deleteAll)
export async function listEventUids(
  creds: AppleCredentials,
  calendarUrl: string
): Promise<string[]> {
  const res = await caldavRequest(
    calendarUrl,
    'PROPFIND',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getetag/>
  </d:prop>
</d:propfind>`,
    { Depth: '1' }
  );
  if (!res.ok) return [];
  const xml = await res.text();
  return extractEventUids(xml, calendarUrl);
}

// --- XML helpers (no library needed) ---

function extractHref(xml: string, tagName: string): string | null {
  // Find the tag content, then extract href within it
  const tagPattern = new RegExp(`<[^>]*${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*${tagName}`, 'i');
  const tagMatch = xml.match(tagPattern);
  if (!tagMatch) return null;
  const hrefMatch = tagMatch[1].match(/<[^>]*href[^>]*>([^<]+)<\//i);
  return hrefMatch ? hrefMatch[1].trim() : null;
}

function findCalendarByName(xml: string, name: string): string | null {
  const blocks: string[] = [];
  const parts = xml.split(/(<[^>]*:?response[^>]*>)/i);
  let inside = false;
  let current = '';
  for (const part of parts) {
    if (/<[^/][^>]*:?response[^>]*>/i.test(part)) { inside = true; current = ''; continue; }
    if (/<\/[^>]*:?response[^>]*>/i.test(part)) { if (inside) blocks.push(current); inside = false; continue; }
    if (inside) current += part;
  }

  for (const block of blocks) {
    // Must be a calendar resourcetype
    if (!/:?calendar[\s/>]/i.test(block)) continue;
    // Extract displayname
    const nameMatch = block.match(/<[^>]*:?displayname[^>]*>([^<]*)<\//i);
    if (!nameMatch || nameMatch[1].trim() !== name) continue;
    // Extract href
    const hrefMatch = block.match(/<[^>]*:?href[^>]*>([^<]+)<\//i);
    return hrefMatch ? hrefMatch[1].trim() : null;
  }
  return null;
}

function extractEventUids(xml: string, _calendarUrl: string): string[] {
  const uids: string[] = [];
  const hrefPattern = /<[^>]*:?href[^>]*>([^<]+\.ics)<\//gi;
  let m: RegExpExecArray | null;
  while ((m = hrefPattern.exec(xml)) !== null) {
    const href = m[1].trim();
    const filename = href.split('/').pop() ?? '';
    if (filename) uids.push(filename.replace(/\.ics$/i, ''));
  }
  return uids;
}
