import {
  discoverCalendarHome,
  getOrCreateCalendar,
  putEvent,
  deleteEvent,
  eventExists,
  listEventUids,
  listSyncedEvents,
  extractSyncedEvents,
  AppleCredentials,
} from '../lib/apple-caldav';

const creds: AppleCredentials = {
  email: 'test@example.com',
  appSpecificPassword: 'xxxx-xxxx-xxxx-xxxx',
};

function mockFetchResponse(
  status: number,
  body = '',
  headers: Record<string, string> = {},
  url = 'https://caldav.icloud.com/'
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: jest.fn().mockResolvedValue(body),
    headers: { get: (key: string) => headers[key] ?? null },
  } as unknown as Response;
}

beforeEach(() => {
  (globalThis as any).fetch = jest.fn();
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

// --- discoverCalendarHome ---

describe('discoverCalendarHome', () => {
  it('returns resolved calendar home URL on happy path', async () => {
    const principalXml = `
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:propstat><d:prop>
          <d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>
        </d:prop></d:propstat></d:response>
      </d:multistatus>`;
    const homeXml = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response><d:propstat><d:prop>
          <c:calendar-home-set><d:href>/123/calendars/</d:href></c:calendar-home-set>
        </d:prop></d:propstat></d:response>
      </d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, principalXml))
      .mockResolvedValueOnce(mockFetchResponse(207, homeXml));

    const result = await discoverCalendarHome(creds);
    expect(result).toBe('https://caldav.icloud.com/123/calendars/');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws AUTH_EXPIRED on 401', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(401));
    await expect(discoverCalendarHome(creds)).rejects.toThrow('AUTH_EXPIRED');
  });

  it('throws when principal href is missing', async () => {
    const xml = `<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop></d:prop></d:propstat></d:response></d:multistatus>`;
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(207, xml));
    await expect(discoverCalendarHome(creds)).rejects.toThrow('Could not find CalDAV principal URL');
  });

  it('throws when calendar-home-set href is missing', async () => {
    const principalXml = `
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:propstat><d:prop>
          <d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>
        </d:prop></d:propstat></d:response>
      </d:multistatus>`;
    const homeXml = `<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop></d:prop></d:propstat></d:response></d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, principalXml))
      .mockResolvedValueOnce(mockFetchResponse(207, homeXml));

    await expect(discoverCalendarHome(creds)).rejects.toThrow('Could not find calendar home set');
  });
});

// --- getOrCreateCalendar ---

describe('getOrCreateCalendar', () => {
  const homeUrl = 'https://caldav.icloud.com/123/calendars/';

  it('returns existing calendar href when found by name', async () => {
    const listXml = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/123/calendars/abc-def/</d:href>
          <d:propstat><d:prop>
            <d:displayname>SubItUp Shifts</d:displayname>
            <d:resourcetype><d:collection/><c:calendar/></d:resourcetype>
          </d:prop></d:propstat>
        </d:response>
      </d:multistatus>`;

    (fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(207, listXml, {}, homeUrl)
    );

    const result = await getOrCreateCalendar(creds, homeUrl, 'SubItUp Shifts');
    expect(result).toBe('https://caldav.icloud.com/123/calendars/abc-def/');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('creates calendar via MKCALENDAR when no match', async () => {
    const emptyListXml = `
      <d:multistatus xmlns:d="DAV:">
        <d:response>
          <d:href>/123/calendars/</d:href>
          <d:propstat><d:prop><d:displayname>Calendars</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
        </d:response>
      </d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, emptyListXml, {}, homeUrl))
      .mockResolvedValueOnce(mockFetchResponse(201));

    const result = await getOrCreateCalendar(creds, homeUrl, 'SubItUp Shifts');
    expect(result).toBe('https://caldav.icloud.com/123/calendars/subitup-shifts/');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch as jest.Mock).mock.calls[1][1].method).toBe('MKCALENDAR');
  });

  it('returns path on MKCALENDAR 403 (already exists)', async () => {
    const emptyListXml = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/123/calendars/</d:href><d:propstat><d:prop><d:displayname>X</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, emptyListXml, {}, homeUrl))
      .mockResolvedValueOnce(mockFetchResponse(403));

    const result = await getOrCreateCalendar(creds, homeUrl, 'SubItUp Shifts');
    expect(result).toBe('https://caldav.icloud.com/123/calendars/subitup-shifts/');
  });

  it('throws on other MKCALENDAR failure (e.g. 500)', async () => {
    const emptyListXml = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/123/calendars/</d:href><d:propstat><d:prop><d:displayname>X</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, emptyListXml, {}, homeUrl))
      .mockResolvedValueOnce(mockFetchResponse(500));

    await expect(getOrCreateCalendar(creds, homeUrl, 'SubItUp Shifts')).rejects.toThrow(
      'CalDAV create calendar failed: 500'
    );
  });

  it('throws user-friendly error on MKCALENDAR 405', async () => {
    const emptyListXml = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/123/calendars/</d:href><d:propstat><d:prop><d:displayname>X</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>`;

    (fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(207, emptyListXml, {}, homeUrl))
      .mockResolvedValueOnce(mockFetchResponse(405));

    await expect(getOrCreateCalendar(creds, homeUrl, 'SubItUp Shifts')).rejects.toThrow(
      /create a calendar named/i
    );
  });
});

// --- putEvent ---

describe('putEvent', () => {
  const calUrl = 'https://caldav.icloud.com/123/calendars/abc/';

  it('returns ETag on 201', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(201, '', { ETag: '"etag-123"' })
    );
    const etag = await putEvent(creds, calUrl, 'uid-1', 'BEGIN:VCALENDAR...');
    expect(etag).toBe('"etag-123"');
  });

  it('sends If-Match header when etag param provided', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(204, '', {}));
    await putEvent(creds, calUrl, 'uid-1', 'BEGIN:VCALENDAR...', '"old-etag"');
    const headers = (fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['If-Match']).toBe('"old-etag"');
  });

  it('throws on error status', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(500));
    await expect(putEvent(creds, calUrl, 'uid-1', 'data')).rejects.toThrow('CalDAV PUT event failed: 500');
  });
});

// --- deleteEvent ---

describe('deleteEvent', () => {
  const calUrl = 'https://caldav.icloud.com/123/calendars/abc/';

  it('succeeds on 204', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(204));
    await expect(deleteEvent(creds, calUrl, 'uid-1')).resolves.toBeUndefined();
  });

  it('succeeds on 404 (already gone)', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(404));
    await expect(deleteEvent(creds, calUrl, 'uid-1')).resolves.toBeUndefined();
  });

  it('throws on other error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(500));
    await expect(deleteEvent(creds, calUrl, 'uid-1')).rejects.toThrow('CalDAV DELETE event failed: 500');
  });
});

// --- eventExists ---

describe('eventExists', () => {
  const calUrl = 'https://caldav.icloud.com/123/calendars/abc/';

  it('returns true on HEAD 200', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(200));
    expect(await eventExists(creds, calUrl, 'uid-1')).toBe(true);
  });

  it('returns false on HEAD 404', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(404));
    expect(await eventExists(creds, calUrl, 'uid-1')).toBe(false);
  });

  it('returns false on network error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));
    expect(await eventExists(creds, calUrl, 'uid-1')).toBe(false);
  });
});

// --- listEventUids ---

describe('listEventUids', () => {
  const calUrl = 'https://caldav.icloud.com/123/calendars/abc/';

  it('parses hrefs ending in .ics and returns UIDs', async () => {
    const xml = `
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/123/calendars/abc/event-a.ics</d:href></d:response>
        <d:response><d:href>/123/calendars/abc/event-b.ics</d:href></d:response>
        <d:response><d:href>/123/calendars/abc/</d:href></d:response>
      </d:multistatus>`;
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(207, xml));
    const uids = await listEventUids(creds, calUrl);
    expect(uids).toEqual(['event-a', 'event-b']);
  });

  it('returns empty array on non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(500));
    const uids = await listEventUids(creds, calUrl);
    expect(uids).toEqual([]);
  });
});

// --- extractSyncedEvents ---

describe('extractSyncedEvents', () => {
  it('extracts UID and X-SUBITUP-HASH from REPORT response', () => {
    const xml = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/cal/event1.ics</d:href>
          <d:propstat><d:prop>
            <c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:subitup-abc123\r\nSUMMARY:Shift A\r\nX-SUBITUP-HASH:1a2b3c\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
          </d:prop></d:propstat>
        </d:response>
        <d:response>
          <d:href>/cal/event2.ics</d:href>
          <d:propstat><d:prop>
            <c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:subitup-def456\r\nSUMMARY:Shift B\r\nX-SUBITUP-HASH:4d5e6f\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
          </d:prop></d:propstat>
        </d:response>
      </d:multistatus>`;

    const results = extractSyncedEvents(xml);
    expect(results).toEqual([
      { uid: 'subitup-abc123', hash: '1a2b3c' },
      { uid: 'subitup-def456', hash: '4d5e6f' },
    ]);
  });

  it('returns null hash for legacy events without X-SUBITUP-HASH', () => {
    const xml = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/cal/event1.ics</d:href>
          <d:propstat><d:prop>
            <c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:subitup-old\r\nSUMMARY:Old Shift\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
          </d:prop></d:propstat>
        </d:response>
      </d:multistatus>`;

    const results = extractSyncedEvents(xml);
    expect(results).toEqual([{ uid: 'subitup-old', hash: null }]);
  });

  it('skips responses without calendar-data', () => {
    const xml = `
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/cal/</d:href><d:propstat><d:prop></d:prop></d:propstat></d:response>
      </d:multistatus>`;

    expect(extractSyncedEvents(xml)).toEqual([]);
  });

  it('returns empty array for empty XML', () => {
    expect(extractSyncedEvents('')).toEqual([]);
  });
});

// --- listSyncedEvents ---

describe('listSyncedEvents', () => {
  const calUrl = 'https://caldav.icloud.com/123/calendars/abc/';

  it('fetches and parses REPORT response', async () => {
    const xml = `
      <d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/cal/event1.ics</d:href>
          <d:propstat><d:prop>
            <c:calendar-data>BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:subitup-s1\r\nSUMMARY:Shift\r\nX-SUBITUP-HASH:abc\r\nEND:VEVENT\r\nEND:VCALENDAR</c:calendar-data>
          </d:prop></d:propstat>
        </d:response>
      </d:multistatus>`;

    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(207, xml));
    const results = await listSyncedEvents(creds, calUrl);
    expect(results).toEqual([{ uid: 'subitup-s1', hash: 'abc' }]);
    expect((fetch as jest.Mock).mock.calls[0][1].method).toBe('REPORT');
  });

  it('returns empty array on error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(500));
    const results = await listSyncedEvents(creds, calUrl);
    expect(results).toEqual([]);
  });
});
