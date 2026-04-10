export interface AppleCredentials {
  email: string;
  appSpecificPassword: string;
}

function resolveUrl(path: string, responseUrl: string): string {
  if (path.startsWith('http')) return path;
  return `${new URL(responseUrl).origin}${path}`;
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
  };
  if (body) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  }
  Object.assign(headers, extraHeaders);
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
  const homeBase = resolveUrl(principalUrl, principalRes.url);
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

  return resolveUrl(homeUrl, homeRes.url);
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
    return resolveUrl(existing, listRes.url);
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
  if (mkRes.status === 403) {
    return calPath; // calendar already exists at this path
  }
  if (mkRes.status === 405) {
    throw new Error(`Could not auto-create calendar. Please create a calendar named "SubItUp Shifts" in iCloud, then retry.`);
  }
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

export interface SyncedEventEntry {
  uid: string;
  hash: string | null;
  start: string | null; // ISO datetime parsed from DTSTART
}

// Fetch all events with their ICS bodies to extract UID and X-SUBITUP-HASH
export async function listSyncedEvents(
  creds: AppleCredentials,
  calendarUrl: string
): Promise<SyncedEventEntry[]> {
  const res = await caldavRequest(
    calendarUrl,
    'REPORT',
    creds,
    `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT"/>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
    { Depth: '1' }
  );
  if (!res.ok) return [];
  const xml = await res.text();
  return extractSyncedEvents(xml);
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
  // Match each DAV response block (handles default namespace and any prefix)
  const responseRe = /<[^/!?][^>]*:?response\b[^>]*>([\s\S]*?)<\/[^>]*:?response\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(xml)) !== null) {
    const block = m[1];
    // Must include a calendar resource type element
    if (!/<[^>]*:?calendar[\s/>]/i.test(block)) continue;
    // Match displayname
    const nameMatch = block.match(/<[^>]*:?displayname\b[^>]*>([^<]*)<\//i);
    if (!nameMatch || nameMatch[1].trim() !== name) continue;
    // Extract href from the full block (opening tag + content)
    const hrefMatch = (m[0]).match(/<[^>]*:?href\b[^>]*>([^<]+)<\//i);
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

function parseIcsDateTime(dtstart: string): string | null {
  // Handles "20260317T140000Z" and "20260317T140000" (local time)
  const m = dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || 'Z'}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function extractSyncedEvents(xml: string): SyncedEventEntry[] {
  const results: SyncedEventEntry[] = [];
  // Match each DAV response block containing calendar-data
  const responseRe = /<[^/!?][^>]*:?response\b[^>]*>([\s\S]*?)<\/[^>]*:?response\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(xml)) !== null) {
    const block = m[1];
    // Extract calendar-data (ICS body) from CDATA or element text
    const calDataMatch = block.match(/<[^>]*:?calendar-data[^>]*>([\s\S]*?)<\/[^>]*:?calendar-data/i);
    if (!calDataMatch) continue;
    const ics = calDataMatch[1].trim();
    // Extract UID from ICS
    const uidMatch = ics.match(/^UID:(.+)$/m);
    if (!uidMatch) continue;
    const uid = uidMatch[1].trim();
    // Extract X-SUBITUP-HASH if present
    const hashMatch = ics.match(/^X-SUBITUP-HASH:(.+)$/m);
    // Extract DTSTART (e.g. "20260317T140000Z") and convert to ISO
    const dtStartMatch = ics.match(/^DTSTART[^:]*:(.+)$/m);
    const start = dtStartMatch ? parseIcsDateTime(dtStartMatch[1].trim()) : null;
    results.push({
      uid,
      hash: hashMatch ? hashMatch[1].trim() : null,
      start,
    });
  }
  return results;
}
