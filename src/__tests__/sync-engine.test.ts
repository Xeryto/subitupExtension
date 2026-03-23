import { Shift } from '../lib/types';
import { CalendarProvider, CalendarEvent, SyncedEventInfo } from '../lib/calendar-provider';
import { computeShiftHash } from '../lib/shift-parser';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
(globalThis as any).chrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[], cb?: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyArr = typeof keys === 'string' ? [keys] : keys;
        for (const k of keyArr) {
          if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(mockStorage, items);
        if (cb) cb();
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[], cb?: () => void) => {
        const keyArr = typeof keys === 'string' ? [keys] : keys;
        for (const k of keyArr) delete mockStorage[k];
        if (cb) cb();
        return Promise.resolve();
      }),
    },
  },
};

// Mock provider
function createMockProvider(syncedEvents: SyncedEventInfo[] = []) {
  return {
    name: 'google',
    getOrCreateCalendar: jest.fn().mockResolvedValue('cal_123'),
    createEvent: jest.fn().mockResolvedValue({ id: 'evt_new' }),
    updateEvent: jest.fn().mockResolvedValue({ id: 'evt_updated' }),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    deleteAllEvents: jest.fn().mockResolvedValue(3),
    eventExists: jest.fn().mockResolvedValue(true),
    listSyncedEvents: jest.fn().mockResolvedValue(syncedEvents),
  } as CalendarProvider & { [K in keyof CalendarProvider]: K extends 'name' ? string : jest.Mock };
}

import { syncShifts, clearSyncedEvents } from '../lib/sync-engine';

let mockProvider: ReturnType<typeof createMockProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  mockProvider = createMockProvider();
});

describe('syncShifts', () => {
  const shifts: Shift[] = [
    { id: 's1', title: 'Front Desk', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' },
    { id: 's2', title: 'Lab', start: '2024-03-18T13:00:00Z', end: '2024-03-18T18:00:00Z' },
  ];

  it('creates events for new shifts', async () => {
    const result = await syncShifts(mockProvider, shifts);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(mockProvider.createEvent).toHaveBeenCalledTimes(2);
    // Hash passed to createEvent: (calendarId, shift, hash)
    expect(mockProvider.createEvent.mock.calls[0][1]).toEqual(shifts[0]);
    expect(mockProvider.createEvent.mock.calls[0][2]).toBe(computeShiftHash(shifts[0]));
  });

  it('updates events when shift content changes', async () => {
    const hash1 = computeShiftHash(shifts[0]);
    const hash2 = computeShiftHash(shifts[1]);
    mockProvider = createMockProvider([
      { shiftId: 's1', calendarEventId: 'e1', hash: hash1 },
      { shiftId: 's2', calendarEventId: 'e2', hash: hash2 },
    ]);

    const modified = [{ ...shifts[0], title: 'Reception' }, shifts[1]];
    const result = await syncShifts(mockProvider, modified);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(1);
    expect(mockProvider.updateEvent.mock.calls[0][1]).toBe('e1');
  });

  it('skips unchanged shifts', async () => {
    const hash1 = computeShiftHash(shifts[0]);
    const hash2 = computeShiftHash(shifts[1]);
    mockProvider = createMockProvider([
      { shiftId: 's1', calendarEventId: 'e1', hash: hash1 },
      { shiftId: 's2', calendarEventId: 'e2', hash: hash2 },
    ]);

    const result = await syncShifts(mockProvider, shifts);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(mockProvider.createEvent).not.toHaveBeenCalled();
    expect(mockProvider.updateEvent).not.toHaveBeenCalled();
  });

  it('updates legacy events with null hash', async () => {
    mockProvider = createMockProvider([
      { shiftId: 's1', calendarEventId: 'e1', hash: null },
    ]);

    const result = await syncShifts(mockProvider, [shifts[0]]);
    expect(result.updated).toBe(1);
    expect(mockProvider.updateEvent).toHaveBeenCalledTimes(1);
  });

  it('stores lastSyncedAt timestamp', async () => {
    await syncShifts(mockProvider, shifts);
    expect(mockStorage['lastSyncedAt_google']).toBeDefined();
  });
});

describe('clearSyncedEvents', () => {
  it('deletes all events and clears timestamp', async () => {
    mockStorage['lastSyncedAt_google'] = '2024-03-17T00:00:00Z';

    const count = await clearSyncedEvents(mockProvider);
    expect(count).toBe(3);
    expect(mockProvider.deleteAllEvents).toHaveBeenCalled();
    expect(mockStorage['lastSyncedAt_google']).toBeUndefined();
  });
});
