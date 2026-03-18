import { Shift } from './types';

function formatIcsDate(isoString: string): string {
  return isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  const lines: string[] = [];
  while (line.length > 75) {
    lines.push(line.substring(0, 75));
    line = ' ' + line.substring(75);
  }
  lines.push(line);
  return lines.join('\r\n');
}

function shiftToVevent(shift: Shift, timezone: string): string {
  const uid = `subitup-${shift.id}@subitup-sync`;
  const now = formatIcsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${formatIcsDate(shift.start)}`,
    `DTEND;TZID=${timezone}:${formatIcsDate(shift.end)}`,
    foldLine(`SUMMARY:${escapeIcsText(shift.title)}`),
  ];
  if (shift.location) {
    lines.push(foldLine(`LOCATION:${escapeIcsText(shift.location)}`));
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function generateIcsString(shifts: Shift[], timezone: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SubItUp Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:SubItUp Shifts`,
    `X-WR-TIMEZONE:${timezone}`,
    ...shifts.map(s => shiftToVevent(s, timezone)),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function generateIcsBlob(shifts: Shift[], timezone: string): Blob {
  return new Blob([generateIcsString(shifts, timezone)], { type: 'text/calendar;charset=utf-8' });
}
