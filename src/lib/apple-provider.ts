import { CalendarProvider, CalendarEvent, SyncedEventInfo } from './calendar-provider';
import { Shift } from './types';
import { AppleCredentials } from './apple-caldav';
import * as caldav from './apple-caldav';

const CALENDAR_NAME = 'SubItUp Shifts';

function shiftToIcal(shift: Shift, sequence = 0, hash?: string): string {
  const uid = eventUid(shift.id);
  const now = toIcsUtc(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SubItUp Sync//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(shift.start)}`,
    `DTEND:${toIcsUtc(shift.end)}`,
    `SUMMARY:${escapeIcs(shift.title)}`,
    `SEQUENCE:${sequence}`,
  ];
  if (shift.location) lines.push(`LOCATION:${escapeIcs(shift.location)}`);
  if (hash) lines.push(`X-SUBITUP-HASH:${hash}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Normalize any ISO string to iCal UTC format: 20260318T140000Z
function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function eventUid(shiftId: string): string {
  const safe = shiftId.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `subitup-${safe}`;
}

// Strip legacy @subitup-sync suffix and convert legacy base64 IDs to base64url
function normalizeUid(uid: string): string {
  const stripped = uid.replace(/@subitup-sync$/, '');
  // Convert any remaining standard base64 chars to base64url
  return stripped.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Extract shiftId from a subitup UID (reverse of eventUid)
function shiftIdFromUid(uid: string): string | null {
  const normalized = normalizeUid(uid);
  if (!normalized.startsWith('subitup-')) return null;
  return normalized.slice('subitup-'.length);
}

export class AppleProvider implements CalendarProvider {
  readonly name = 'apple';
  private calendarHome: string | null = null;
  private calendarUrl: string | null = null;

  constructor(private creds: AppleCredentials) {}

  async getOrCreateCalendar(): Promise<string> {
    if (this.calendarUrl) return this.calendarUrl;
    if (!this.calendarHome) {
      this.calendarHome = await caldav.discoverCalendarHome(this.creds);
    }
    this.calendarUrl = await caldav.getOrCreateCalendar(this.creds, this.calendarHome, CALENDAR_NAME);
    return this.calendarUrl;
  }

  async createEvent(calendarId: string, shift: Shift, hash?: string): Promise<CalendarEvent> {
    const uid = eventUid(shift.id);
    const ical = shiftToIcal(shift, 0, hash);
    const etag = await caldav.putEvent(this.creds, calendarId, uid, ical);
    return { id: uid, etag };
  }

  async updateEvent(calendarId: string, eventId: string, shift: Shift, hash?: string): Promise<CalendarEvent> {
    const uid = normalizeUid(eventId);
    const ical = shiftToIcal(shift, 1, hash);
    const etag = await caldav.putEvent(this.creds, calendarId, uid, ical);
    return { id: uid, etag };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return caldav.deleteEvent(this.creds, calendarId, normalizeUid(eventId));
  }

  async eventExists(calendarId: string, eventId: string): Promise<boolean> {
    return caldav.eventExists(this.creds, calendarId, normalizeUid(eventId));
  }

  async listSyncedEvents(calendarId: string): Promise<SyncedEventInfo[]> {
    const entries = await caldav.listSyncedEvents(this.creds, calendarId);
    return entries
      .map(e => {
        const shiftId = shiftIdFromUid(e.uid);
        if (!shiftId) return null;
        return {
          shiftId,
          calendarEventId: e.uid,
          hash: e.hash,
        };
      })
      .filter((e): e is SyncedEventInfo => e !== null);
  }

  async deleteAllEvents(calendarId: string): Promise<number> {
    const uids = await caldav.listEventUids(this.creds, calendarId);
    for (const uid of uids) {
      await caldav.deleteEvent(this.creds, calendarId, uid);
      await new Promise(r => setTimeout(r, 200));
    }
    return uids.length;
  }
}
