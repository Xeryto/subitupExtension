import { Shift } from './types';

const BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_NAME = 'SubItUp Shifts';

async function apiRequest<T>(
  token: string,
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API ${res.status}: ${text}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

interface CalendarListEntry {
  id: string;
  summary: string;
}

interface CalendarListResponse {
  items: CalendarListEntry[];
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

interface EventListResponse {
  items: CalendarEvent[];
  nextPageToken?: string;
}

export async function getOrCreateCalendar(token: string): Promise<string> {
  // Check existing calendars
  const list = await apiRequest<CalendarListResponse>(token, '/users/me/calendarList');
  const existing = list.items?.find(c => c.summary === CALENDAR_NAME);
  if (existing) return existing.id;

  // Create new calendar
  const created = await apiRequest<{ id: string }>(token, '/calendars', 'POST', {
    summary: CALENDAR_NAME,
    description: 'Shifts synced from SubItUp by SubItUp Sync extension',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return created.id;
}

export async function listEvents(
  token: string,
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ maxResults: '2500', singleEvents: 'true' });
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);
    const res = await apiRequest<EventListResponse>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    if (res.items) events.push(...res.items);
    pageToken = res.nextPageToken;
  } while (pageToken);

  return events;
}

export async function createEvent(
  token: string,
  calendarId: string,
  shift: Shift
): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    'POST',
    shiftToEvent(shift)
  );
}

export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  shift: Shift
): Promise<CalendarEvent> {
  return apiRequest<CalendarEvent>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    'PUT',
    shiftToEvent(shift)
  );
}

export async function eventExists(
  token: string,
  calendarId: string,
  eventId: string
): Promise<boolean> {
  try {
    await apiRequest<CalendarEvent>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  await apiRequest<void>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    'DELETE'
  );
}

export async function deleteAllEvents(
  token: string,
  calendarId: string
): Promise<number> {
  const events = await listEvents(token, calendarId);
  let count = 0;
  for (const event of events) {
    await deleteEvent(token, calendarId, event.id);
    count++;
    await delay(200);
  }
  return count;
}

function shiftToEvent(shift: Shift): object {
  return {
    summary: shift.title,
    location: shift.location,
    start: {
      dateTime: shift.start,
    },
    end: {
      dateTime: shift.end,
    },
    extendedProperties: {
      private: {
        subitupShiftId: shift.id,
      },
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
