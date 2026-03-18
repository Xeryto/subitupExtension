import { Shift, SyncRecord } from '../lib/types';
import { CalendarProvider, CalendarEvent } from '../lib/calendar-provider';

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
function createMockProvider(): CalendarProvider & { createEvent: jest.Mock; updateEvent: jest.Mock; deleteEvent: jest.Mock; deleteAllEvents: jest.Mock; eventExists: jest.Mock } {
  return {
    name: 'google',
    getOrCreateCalendar: jest.fn().mockResolvedValue('cal_123'),
    createEvent: jest.fn().mockResolvedValue({ id: 'evt_new' }),
    updateEvent: jest.fn().mockResolvedValue({ id: 'evt_updated' }),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    deleteAllEvents: jest.fn().mockResolvedValue(3),
    eventExists: jest.fn().mockResolvedValue(true),
  };
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
    expect(result.deleted).toBe(0);
    expect(mockProvider.createEvent).toHaveBeenCalledTimes(2);
  });

  it('updates events when shift content changes', async () => {
    await syncShifts(mockProvider, shifts);

    const modified = [{ ...shifts[0], title: 'Reception' }, shifts[1]];
    const result = await syncShifts(mockProvider, modified);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it('skips unchanged shifts', async () => {
    await syncShifts(mockProvider, shifts);
    mockProvider.createEvent.mockClear();

    const result = await syncShifts(mockProvider, shifts);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(mockProvider.createEvent).not.toHaveBeenCalled();
  });

  it('uses namespaced storage keys', async () => {
    await syncShifts(mockProvider, shifts);
    expect(mockStorage['syncRecords_google']).toBeDefined();
    expect(mockStorage['lastSyncedAt_google']).toBeDefined();
  });
});

describe('clearSyncedEvents', () => {
  it('deletes all events and clears storage', async () => {
    mockStorage['syncRecords_google'] = [{ shiftId: 's1', calendarEventId: 'e1', hash: 'h', lastSyncedAt: '' }];
    mockStorage['lastSyncedAt_google'] = '2024-03-17T00:00:00Z';

    const count = await clearSyncedEvents(mockProvider);
    expect(count).toBe(3);
    expect(mockProvider.deleteAllEvents).toHaveBeenCalled();
    expect(mockStorage['syncRecords_google']).toBeUndefined();
    expect(mockStorage['lastSyncedAt_google']).toBeUndefined();
  });
});
