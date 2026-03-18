import { generateIcsString } from '../lib/ics-export';
import { Shift } from '../lib/types';

const FROZEN_ISO = '20240101T000000Z';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

const shift = (overrides: Partial<Shift> = {}): Shift => ({
  id: '42',
  title: 'Front Desk',
  start: '2024-03-17T09:00:00.000Z',
  end: '2024-03-17T17:00:00.000Z',
  ...overrides,
});

describe('generateIcsString', () => {
  it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR\\r\\n', () => {
    const ics = generateIcsString([], 'America/Chicago');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('contains VERSION, PRODID, CALSCALE, METHOD headers', () => {
    const ics = generateIcsString([], 'America/Chicago');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//SubItUp Sync//EN');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('METHOD:PUBLISH');
  });

  it('includes X-WR-TIMEZONE matching passed timezone', () => {
    const ics = generateIcsString([], 'US/Eastern');
    expect(ics).toContain('X-WR-TIMEZONE:US/Eastern');
  });

  it('produces correct VEVENT for a single shift', () => {
    const ics = generateIcsString([shift()], 'America/Chicago');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:subitup-42@subitup-sync');
    expect(ics).toContain('DTSTART;TZID=America/Chicago:20240317T090000');
    expect(ics).toContain('DTEND;TZID=America/Chicago:20240317T170000');
    expect(ics).toContain('SUMMARY:Front Desk');
    expect(ics).toContain('END:VEVENT');
  });

  it('includes DTSTAMP in each VEVENT', () => {
    const ics = generateIcsString([shift()], 'America/Chicago');
    expect(ics).toContain(`DTSTAMP:${FROZEN_ISO}`);
  });

  it('includes LOCATION when shift.location is set', () => {
    const ics = generateIcsString([shift({ location: 'Main Hall' })], 'America/Chicago');
    expect(ics).toContain('LOCATION:Main Hall');
  });

  it('omits LOCATION when shift.location is undefined', () => {
    const ics = generateIcsString([shift()], 'America/Chicago');
    expect(ics).not.toContain('LOCATION');
  });

  it('produces one VEVENT per shift for multiple shifts', () => {
    const shifts = [shift({ id: '1' }), shift({ id: '2' }), shift({ id: '3' })];
    const ics = generateIcsString(shifts, 'America/Chicago');
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(3);
    expect((ics.match(/END:VEVENT/g) || []).length).toBe(3);
  });

  it('produces valid calendar with no VEVENTs for empty array', () => {
    const ics = generateIcsString([], 'America/Chicago');
    expect(ics).not.toContain('VEVENT');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('escapes semicolons, commas, backslashes, and newlines in text', () => {
    const ics = generateIcsString(
      [shift({ title: 'A;B,C\\D\nE', location: 'X;Y' })],
      'America/Chicago'
    );
    expect(ics).toContain('SUMMARY:A\\;B\\,C\\\\D\\nE');
    expect(ics).toContain('LOCATION:X\\;Y');
  });

  it('folds lines longer than 75 characters', () => {
    const longTitle = 'A'.repeat(100);
    const ics = generateIcsString([shift({ title: longTitle })], 'America/Chicago');
    // After folding, continuation lines start with a space
    const lines = ics.split('\r\n');
    const summaryIdx = lines.findIndex(l => l.startsWith('SUMMARY:'));
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    // The SUMMARY line should be <= 75 chars, next line starts with space
    expect(lines[summaryIdx].length).toBeLessThanOrEqual(75);
    expect(lines[summaryIdx + 1].startsWith(' ')).toBe(true);
  });

  it('strips dashes, colons, and milliseconds from dates', () => {
    const ics = generateIcsString(
      [shift({ start: '2024-03-17T09:00:00.123Z', end: '2024-03-17T17:30:00.456Z' })],
      'America/Chicago'
    );
    expect(ics).toContain('20240317T090000Z');
    expect(ics).toContain('20240317T173000Z');
  });
});
