import { Shift, SyncRecord } from './types';
import { computeShiftHash } from './shift-parser';
import * as cal from './calendar-api';

const SYNC_RECORDS_KEY = 'syncRecords';
const LAST_SYNCED_KEY = 'lastSyncedAt';

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export async function syncShifts(token: string, shifts: Shift[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

  console.log('[Sync] Starting sync for', shifts.length, 'shifts');

  // Get or create the SubItUp Shifts calendar
  const calendarId = await cal.getOrCreateCalendar(token);
  console.log('[Sync] Calendar ID:', calendarId);

  // Load existing sync records
  const storage = await chrome.storage.local.get(SYNC_RECORDS_KEY);
  const records: SyncRecord[] = storage[SYNC_RECORDS_KEY] || [];
  const recordMap = new Map(records.map(r => [r.shiftId, r]));
  console.log('[Sync] Existing records:', records.length, records.map(r => r.shiftId));

  const newRecords: SyncRecord[] = [];
  const processedShiftIds = new Set<string>();

  // Create or update events for current shifts
  for (const shift of shifts) {
    processedShiftIds.add(shift.id);
    const hash = computeShiftHash(shift);
    const existing = recordMap.get(shift.id);

    console.log('[Sync] Processing shift:', shift.id, shift.title, '| existing record:', !!existing, '| hash match:', existing?.hash === hash);

    try {
      if (!existing) {
        console.log('[Sync] Creating new event for:', shift.title);
        const event = await cal.createEvent(token, calendarId, shift);
        newRecords.push({
          shiftId: shift.id,
          calendarEventId: event.id,
          lastSyncedAt: new Date().toISOString(),
          hash,
        });
        result.created++;
      } else if (existing.hash !== hash) {
        console.log('[Sync] Updating event for:', shift.title, '| old hash:', existing.hash, '| new hash:', hash);
        await cal.updateEvent(token, calendarId, existing.calendarEventId, shift);
        newRecords.push({
          ...existing,
          lastSyncedAt: new Date().toISOString(),
          hash,
        });
        result.updated++;
      } else {
        // Unchanged — verify event still exists, recreate if deleted
        console.log('[Sync] Checking if event exists:', existing.calendarEventId);
        const exists = await cal.eventExists(token, calendarId, existing.calendarEventId);
        console.log('[Sync] Event exists:', exists);
        if (exists) {
          newRecords.push(existing);
        } else {
          console.log('[Sync] Recreating deleted event for:', shift.title);
          const event = await cal.createEvent(token, calendarId, shift);
          newRecords.push({
            shiftId: shift.id,
            calendarEventId: event.id,
            lastSyncedAt: new Date().toISOString(),
            hash,
          });
          result.created++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Sync] Error for shift:', shift.title, msg);
      if (msg === 'AUTH_EXPIRED') throw err;
      result.errors.push(`${shift.title}: ${msg}`);
    }

    await delay(200);
  }

  // Keep records for shifts not in current batch (they may be from other date ranges)
  for (const record of records) {
    if (!processedShiftIds.has(record.shiftId)) {
      newRecords.push(record);
    }
  }

  // Save updated sync records
  const now = new Date().toISOString();
  await chrome.storage.local.set({
    [SYNC_RECORDS_KEY]: newRecords,
    [LAST_SYNCED_KEY]: now,
  });

  return result;
}

export async function clearSyncedEvents(token: string): Promise<number> {
  const calendarId = await cal.getOrCreateCalendar(token);
  const count = await cal.deleteAllEvents(token, calendarId);

  await chrome.storage.local.remove([SYNC_RECORDS_KEY, LAST_SYNCED_KEY]);
  return count;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
