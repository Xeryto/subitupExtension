import { Shift, SyncRecord } from './types';
import { computeShiftHash } from './shift-parser';
import { CalendarProvider } from './calendar-provider';

function syncRecordsKey(provider: string): string {
  return `syncRecords_${provider}`;
}

function lastSyncedKey(provider: string): string {
  return `lastSyncedAt_${provider}`;
}

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export async function syncShifts(provider: CalendarProvider, shifts: Shift[]): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };
  const recordsKey = syncRecordsKey(provider.name);
  const syncedKey = lastSyncedKey(provider.name);

  console.log(`[Sync:${provider.name}] Starting sync for`, shifts.length, 'shifts');

  const calendarId = await provider.getOrCreateCalendar();
  console.log(`[Sync:${provider.name}] Calendar ID:`, calendarId);

  const storage = await chrome.storage.local.get(recordsKey);
  const records: SyncRecord[] = storage[recordsKey] || [];
  const recordMap = new Map(records.map(r => [r.shiftId, r]));
  console.log(`[Sync:${provider.name}] Existing records:`, records.length);

  const newRecords: SyncRecord[] = [];
  const processedShiftIds = new Set<string>();

  for (const shift of shifts) {
    processedShiftIds.add(shift.id);
    const hash = computeShiftHash(shift);
    const existing = recordMap.get(shift.id);

    try {
      if (!existing) {
        console.log(`[Sync:${provider.name}] Creating:`, shift.title);
        const event = await provider.createEvent(calendarId, shift);
        newRecords.push({
          shiftId: shift.id,
          calendarEventId: event.id,
          lastSyncedAt: new Date().toISOString(),
          hash,
        });
        result.created++;
      } else if (existing.hash !== hash) {
        console.log(`[Sync:${provider.name}] Updating:`, shift.title);
        await provider.updateEvent(calendarId, existing.calendarEventId, shift);
        newRecords.push({
          ...existing,
          lastSyncedAt: new Date().toISOString(),
          hash,
        });
        result.updated++;
      } else {
        const exists = await provider.eventExists(calendarId, existing.calendarEventId);
        if (exists) {
          newRecords.push(existing);
        } else {
          console.log(`[Sync:${provider.name}] Recreating deleted:`, shift.title);
          const event = await provider.createEvent(calendarId, shift);
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
      console.error(`[Sync:${provider.name}] Error:`, shift.title, msg);
      if (msg === 'AUTH_EXPIRED') {
        // Save partial progress so retry doesn't duplicate already-created events
        const unprocessed = records.filter(r => !processedShiftIds.has(r.shiftId));
        await chrome.storage.local.set({ [recordsKey]: [...newRecords, ...unprocessed] });
        throw err;
      }
      result.errors.push(`${shift.title}: ${msg}`);
    }

    await delay(200);
  }

  // Keep records for shifts not in current batch
  for (const record of records) {
    if (!processedShiftIds.has(record.shiftId)) {
      newRecords.push(record);
    }
  }

  const now = new Date().toISOString();
  await chrome.storage.local.set({
    [recordsKey]: newRecords,
    [syncedKey]: now,
  });

  return result;
}

export async function clearSyncedEvents(provider: CalendarProvider): Promise<number> {
  const recordsKey = syncRecordsKey(provider.name);
  const syncedKey = lastSyncedKey(provider.name);

  const calendarId = await provider.getOrCreateCalendar();
  const count = await provider.deleteAllEvents(calendarId);

  await chrome.storage.local.remove([recordsKey, syncedKey]);
  return count;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
