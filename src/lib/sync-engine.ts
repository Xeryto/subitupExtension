import { Shift } from './types';
import { computeShiftHash } from './shift-parser';
import { CalendarProvider, SyncedEventInfo } from './calendar-provider';

function lastSyncedKey(provider: string): string {
  return `lastSyncedAt_${provider}`;
}

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface ViewedRange { from: string; to: string } // "YYYY-MM-DD"

export async function syncShifts(provider: CalendarProvider, shifts: Shift[], viewedRange?: ViewedRange): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };
  const syncedKey = lastSyncedKey(provider.name);

  const calendarId = await provider.getOrCreateCalendar();

  // Fetch existing events from the calendar (source of truth)
  const existing = await provider.listSyncedEvents(calendarId);
  const eventMap = new Map<string, SyncedEventInfo>(existing.map(e => [e.shiftId, e]));

  for (const shift of shifts) {
    const hash = computeShiftHash(shift);
    const entry = eventMap.get(shift.id);

    try {
      if (!entry) {
        // New shift — create
        await provider.createEvent(calendarId, shift, hash);
        result.created++;
      } else if (entry.hash !== hash) {
        // Changed or legacy event without hash — update
        await provider.updateEvent(calendarId, entry.calendarEventId, shift, hash);
        result.updated++;
      }
      // else: hash matches — skip
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Sync:${provider.name}] Error:`, shift.title, msg);
      if (msg === 'AUTH_EXPIRED') throw err;
      result.errors.push(`${shift.title}: ${msg}`);
    }

    await delay(200);
  }

  // Delete calendar events for shifts no longer in the schedule,
  // but only within the date range we know was fully fetched from SubItUp.
  const incomingIds = new Set(shifts.map(s => s.id));
  for (const entry of existing) {
    if (incomingIds.has(entry.shiftId)) continue;
    if (!viewedRange || !isInRange(entry.start, viewedRange)) continue;
    try {
      await provider.deleteEvent(calendarId, entry.calendarEventId);
      result.deleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Sync:${provider.name}] Delete error:`, entry.shiftId, msg);
      result.errors.push(`delete ${entry.shiftId}: ${msg}`);
    }
    await delay(200);
  }

  await chrome.storage.local.set({ [syncedKey]: new Date().toISOString() });

  return result;
}

export async function clearSyncedEvents(provider: CalendarProvider): Promise<number> {
  const syncedKey = lastSyncedKey(provider.name);

  const calendarId = await provider.getOrCreateCalendar();
  const count = await provider.deleteAllEvents(calendarId);

  await chrome.storage.local.remove([syncedKey]);
  return count;
}

// Returns true if the ISO datetime string falls within the YYYY-MM-DD range (inclusive)
function isInRange(isoStart: string, range: ViewedRange): boolean {
  if (!isoStart) return false;
  const date = isoStart.slice(0, 10); // "YYYY-MM-DD"
  return date >= range.from && date <= range.to;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
