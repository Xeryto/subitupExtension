import { Shift } from './types';

export interface CalendarEvent {
  id: string;
  etag?: string;
}

export interface CalendarProvider {
  readonly name: string;
  getOrCreateCalendar(): Promise<string>;
  createEvent(calendarId: string, shift: Shift): Promise<CalendarEvent>;
  updateEvent(calendarId: string, eventId: string, shift: Shift): Promise<CalendarEvent>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  eventExists(calendarId: string, eventId: string): Promise<boolean>;
  deleteAllEvents(calendarId: string): Promise<number>;
}
