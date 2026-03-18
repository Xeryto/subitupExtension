import { parseSubItUpResponse, computeShiftHash } from '../lib/shift-parser';

describe('parseSubItUpResponse', () => {
  it('parses array of shifts', () => {
    const data = [
      {
        id: '1',
        position_name: 'Front Desk',
        start_time: '2024-03-17T09:00:00Z',
        end_time: '2024-03-17T17:00:00Z',
        location: 'Main Hall',
      },
      {
        id: '2',
        position_name: 'Lab Assist',
        start_time: '2024-03-18T13:00:00Z',
        end_time: '2024-03-18T18:00:00Z',
      },
    ];
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(2);
    expect(shifts[0].title).toBe('Front Desk');
    expect(shifts[0].location).toBe('Main Hall');
    expect(shifts[1].title).toBe('Lab Assist');
  });

  it('parses { shifts: [...] } wrapper', () => {
    const data = {
      shifts: [
        { id: '10', title: 'Cashier', start: '2024-03-20T08:00:00Z', end: '2024-03-20T16:00:00Z' },
      ],
    };
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].title).toBe('Cashier');
  });

  it('parses { data: [...] } wrapper', () => {
    const data = {
      data: [
        { shift_id: '20', positionName: 'Guard', startTime: '2024-03-21T06:00:00Z', endTime: '2024-03-21T14:00:00Z' },
      ],
    };
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(1);
    expect(shifts[0].id).toBe('20');
  });

  it('parses date-keyed structure', () => {
    const data = {
      '2024-03-17': [
        { id: '30', position: 'RA', start: '2024-03-17T20:00:00Z', end: '2024-03-17T23:00:00Z' },
      ],
      '2024-03-18': [
        { id: '31', name: 'Tutor', start: '2024-03-18T10:00:00Z', end: '2024-03-18T12:00:00Z' },
      ],
    };
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(2);
  });

  it('handles unix timestamps', () => {
    const data = [
      { id: '40', title: 'Shift', start: 1710680400, end: 1710709200 }, // seconds
    ];
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(1);
    expect(new Date(shifts[0].start).getFullYear()).toBeGreaterThan(2020);
  });

  it('filters invalid shifts', () => {
    const data = [
      { id: '50', title: 'Bad', start: 'nope', end: '2024-03-17T12:00:00Z' },
      { id: '51', title: '', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' },
      { id: '52', title: 'Backwards', start: '2024-03-17T17:00:00Z', end: '2024-03-17T09:00:00Z' },
    ];
    const shifts = parseSubItUpResponse(data);
    expect(shifts).toHaveLength(0);
  });

  it('returns empty for null/undefined', () => {
    expect(parseSubItUpResponse(null)).toEqual([]);
    expect(parseSubItUpResponse(undefined)).toEqual([]);
    expect(parseSubItUpResponse(42)).toEqual([]);
  });
});

describe('computeShiftHash', () => {
  it('produces consistent hashes', () => {
    const shift = { id: '1', title: 'Desk', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' };
    expect(computeShiftHash(shift)).toBe(computeShiftHash(shift));
  });

  it('changes when content changes', () => {
    const a = { id: '1', title: 'Desk', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' };
    const b = { id: '1', title: 'Lab', start: '2024-03-17T09:00:00Z', end: '2024-03-17T17:00:00Z' };
    expect(computeShiftHash(a)).not.toBe(computeShiftHash(b));
  });
});
