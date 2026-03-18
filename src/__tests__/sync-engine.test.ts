import { Shift, SyncRecord } from '../lib/types';

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

// Mock calendar-api
jest.mock('../lib/calendar-api', () => ({
  getOrCreateCalendar: jest.fn().mockResolvedValue('cal_123'),
  createEvent: jest.fn().mockResolvedValue({ id: 'evt_new' }),
  updateEvent: jest.fn().mockResolvedValue({ id: 'evt_updated' }),
  deleteEvent: jest.fn().mockResolvedValue(undefined),
  deleteAllEvents: jest.fn().mockResolvedValue(3),
}));

import { syncShifts, clearSyncedEvents } from '../lib/sync-engine';
import * as cal from '../lib/calendar-api';

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

describe('syncShifts', () => {
  const shifts: Shift[] = [
    { id: 's1', title: 'Front Desk', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' },
    { id: 's2', title: 'Lab', start: '2024-03-18T13:00:00Z', end: '2024-03-18T18:00:00Z' },
  ];

  it('creates events for new shifts', async () => {
    const result = await syncShifts('token123', shifts);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(cal.createEvent).toHaveBeenCalledTimes(2);
  });

  it('updates events when shift content changes', async () => {
    // First sync
    await syncShifts('token123', shifts);

    // Change a shift title
    const modified = [{ ...shifts[0], title: 'Reception' }, shifts[1]];
    const result = await syncShifts('token123', modified);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it('deletes events for removed shifts', async () => {
    // First sync with 2 shifts
    await syncShifts('token123', shifts);

    // Second sync with only 1 shift
    const result = await syncShifts('token123', [shifts[0]]);
    expect(result.deleted).toBe(1);
    expect(cal.deleteEvent).toHaveBeenCalledTimes(1);
  });

  it('skips unchanged shifts', async () => {
    await syncShifts('token123', shifts);
    jest.clearAllMocks();

    const result = await syncShifts('token123', shifts);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
    expect(cal.createEvent).not.toHaveBeenCalled();
  });
});

describe('clearSyncedEvents', () => {
  it('deletes all events and clears storage', async () => {
    mockStorage['syncRecords'] = [{ shiftId: 's1', calendarEventId: 'e1', hash: 'h', lastSyncedAt: '' }];
    mockStorage['lastSyncedAt'] = '2024-03-17T00:00:00Z';

    const count = await clearSyncedEvents('token123');
    expect(count).toBe(3);
    expect(cal.deleteAllEvents).toHaveBeenCalled();
  });
});
