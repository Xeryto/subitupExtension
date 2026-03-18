import { groupByDay, formatTime, formatDateRange, getWeekBounds, getTwoWeekBounds, getMonthBounds } from '../utils/date';
import { Shift } from '../lib/types';

describe('formatTime', () => {
  it('formats morning time', () => {
    expect(formatTime('2024-03-17T09:00:00')).toBe('9a');
  });

  it('formats afternoon with minutes', () => {
    expect(formatTime('2024-03-17T13:30:00')).toBe('1:30p');
  });

  it('formats noon', () => {
    expect(formatTime('2024-03-17T12:00:00')).toBe('12p');
  });

  it('formats midnight', () => {
    expect(formatTime('2024-03-17T00:00:00')).toBe('12a');
  });
});

describe('groupByDay', () => {
  it('groups shifts by day', () => {
    const shifts: Shift[] = [
      { id: '1', title: 'A', start: '2024-03-17T09:00:00', end: '2024-03-17T17:00:00' },
      { id: '2', title: 'B', start: '2024-03-17T18:00:00', end: '2024-03-17T22:00:00' },
      { id: '3', title: 'C', start: '2024-03-18T10:00:00', end: '2024-03-18T14:00:00' },
    ];
    const groups = groupByDay(shifts);
    expect(groups.size).toBe(2);
  });

  it('handles empty array', () => {
    expect(groupByDay([]).size).toBe(0);
  });
});

describe('formatDateRange', () => {
  it('formats range from shifts', () => {
    const shifts: Shift[] = [
      { id: '1', title: 'A', start: '2024-03-17T09:00:00', end: '2024-03-17T17:00:00' },
      { id: '2', title: 'B', start: '2024-03-30T09:00:00', end: '2024-03-30T17:00:00' },
    ];
    const range = formatDateRange(shifts);
    expect(range).toContain('Mar');
    expect(range).toContain('17');
    expect(range).toContain('30');
  });

  it('returns empty for no shifts', () => {
    expect(formatDateRange([])).toBe('');
  });
});

describe('getWeekBounds', () => {
  it('returns 7-day range starting on Sunday', () => {
    const { start, end } = getWeekBounds(new Date('2024-03-20'));
    expect(start.getDay()).toBe(0); // Sunday
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('getTwoWeekBounds', () => {
  it('returns 14-day range', () => {
    const { start, end } = getTwoWeekBounds(new Date('2024-03-20'));
    expect(end.getTime() - start.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });
});

describe('getMonthBounds', () => {
  it('returns month range', () => {
    const { start, end } = getMonthBounds(new Date('2024-03-15'));
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(2); // March
    expect(end.getMonth()).toBe(3); // April
  });
});
