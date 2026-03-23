import { CalendarProvider, CalendarEvent, SyncedEventInfo } from './calendar-provider';
import { Shift } from './types';
import * as cal from './calendar-api';

export class GoogleProvider implements CalendarProvider {
  readonly name = 'google';

  constructor(private token: string) {}

  async getOrCreateCalendar(): Promise<string> {
    return cal.getOrCreateCalendar(this.token);
  }

  async createEvent(calendarId: string, shift: Shift, hash?: string): Promise<CalendarEvent> {
    const evt = await cal.createEvent(this.token, calendarId, shift, hash);
    return { id: evt.id };
  }

  async updateEvent(calendarId: string, eventId: string, shift: Shift, hash?: string): Promise<CalendarEvent> {
    const evt = await cal.updateEvent(this.token, calendarId, eventId, shift, hash);
    return { id: evt.id };
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    return cal.deleteEvent(this.token, calendarId, eventId);
  }

  async eventExists(calendarId: string, eventId: string): Promise<boolean> {
    return cal.eventExists(this.token, calendarId, eventId);
  }

  async listSyncedEvents(calendarId: string): Promise<SyncedEventInfo[]> {
    return cal.listSyncedEvents(this.token, calendarId);
  }

  async deleteAllEvents(calendarId: string): Promise<number> {
    return cal.deleteAllEvents(this.token, calendarId);
  }
}
