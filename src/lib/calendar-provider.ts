import { Shift } from './types';

export interface CalendarEvent {
  id: string;
  etag?: string;
}

export interface SyncedEventInfo {
  shiftId: string;
  calendarEventId: string;
  hash: string | null;
  start: string; // ISO datetime
}

export interface CalendarProvider {
  readonly name: string;
  getOrCreateCalendar(): Promise<string>;
  createEvent(calendarId: string, shift: Shift, hash?: string): Promise<CalendarEvent>;
  updateEvent(calendarId: string, eventId: string, shift: Shift, hash?: string): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  eventExists(calendarId: string, eventId: string): Promise<boolean>;
  listSyncedEvents(calendarId: string): Promise<SyncedEventInfo[]>;
  deleteAllEvents(calendarId: string): Promise<number>;
}
