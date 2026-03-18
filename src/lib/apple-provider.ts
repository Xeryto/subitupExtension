import { CalendarProvider, CalendarEvent } from './calendar-provider';
import { Shift } from './types';
import { AppleCredentials } from './apple-caldav';
import * as caldav from './apple-caldav';

const CALENDAR_NAME = 'SubItUp Shifts';

function shiftToIcal(shift: Shift): string {
  const uid = `subitup-${shift.id}@subitup-sync`;
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
  ];
  if (shift.location) lines.push(`LOCATION:${escapeIcs(shift.location)}`);
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
  return `subitup-${shiftId}@subitup-sync`;
}

export class AppleProvider implements CalendarProvider {
  readonly name = 'apple';
  private calendarHome: string | null = null;

  constructor(private creds: AppleCredentials) {}

  async getOrCreateCalendar(): Promise<string> {
    if (!this.calendarHome) {
      this.calendarHome = await caldav.discoverCalendarHome(this.creds);
    }
    return caldav.getOrCreateCalendar(this.creds, this.calendarHome, CALENDAR_NAME);
  }

  async createEvent(calendarId: string, shift: Shift): Promise<CalendarEvent> {
    const uid = eventUid(shift.id);
    const ical = shiftToIcal(shift);
    const etag = await caldav.putEvent(this.creds, calendarId, uid, ical);
    return { id: uid, etag };
  }

  async updateEvent(calendarId: string, eventId: string, shift: Shift): Promise<CalendarEvent> {
    const ical = shiftToIcal(shift);
    const etag = await caldav.putEvent(this.creds, calendarId, eventId, ical);
    return { id: eventId, etag };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return caldav.deleteEvent(this.creds, calendarId, eventId);
  }

  async eventExists(calendarId: string, eventId: string): Promise<boolean> {
    return caldav.eventExists(this.creds, calendarId, eventId);
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
