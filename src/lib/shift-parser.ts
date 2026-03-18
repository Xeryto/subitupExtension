import { Shift } from './types';

/**
 * Parse SubItUp schedule API responses into normalized Shift[].
 * Primary format: GetEmployeeScheduleData returns an array of shift objects.
 */
export function parseSubItUpResponse(data: unknown): Shift[] {
  if (!data || typeof data !== 'object') return [];

  // Handle array of shifts directly (SubItUp's GetEmployeeScheduleData format)
  if (Array.isArray(data)) {
    return data.flatMap(item => parseShiftItem(item)).filter(isValidShift);
  }

  const obj = data as Record<string, unknown>;

  // Handle wrapper objects
  for (const key of ['shifts', 'data', 'd']) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).flatMap(item => parseShiftItem(item)).filter(isValidShift);
    }
  }

  // Handle { schedule: { shifts: [...] } }
  if (obj.schedule && typeof obj.schedule === 'object') {
    const schedule = obj.schedule as Record<string, unknown>;
    if (Array.isArray(schedule.shifts)) {
      return schedule.shifts.flatMap(item => parseShiftItem(item)).filter(isValidShift);
    }
  }

  // Handle date-keyed structure: { "2024-03-17": [...shifts] }
  const shifts: Shift[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (/^\d{4}-\d{2}-\d{2}/.test(key) && Array.isArray(value)) {
      shifts.push(...value.flatMap(item => parseShiftItem(item)).filter(isValidShift));
    }
  }

  return shifts;
}

function parseShiftItem(item: unknown): Shift[] {
  if (!item || typeof item !== 'object') return [];
  const obj = item as Record<string, unknown>;

  // SubItUp: skip "Available Shift" — only capture assigned shifts
  const blockTitle = obj.BlockTitle ?? obj.blockTitle;
  if (typeof blockTitle === 'string' && blockTitle !== "You're Working!") {
    return [];
  }

  // ID
  const id = String(
    obj.shiftid ?? obj.shiftId ?? obj.shift_id ?? obj.id ?? ''
  );

  // Title: combine department (Title) + shift name (ShiftName) for SubItUp format
  const deptName = obj.deptName ?? obj.Title ?? obj.title ?? '';
  const shiftName = obj.ShiftName ?? obj.shiftName ?? '';
  let title: string;
  if (deptName && shiftName) {
    title = `${decodeURIComponent(String(deptName))} — ${decodeURIComponent(String(shiftName))}`;
  } else {
    title = String(
      shiftName || deptName || obj.position_name || obj.positionName || obj.position || obj.name || 'Shift'
    );
    title = decodeURIComponent(title);
  }

  // Location (SubItUp doesn't have a dedicated field, but ShiftNotes sometimes has it)
  const notes = obj.ShiftNotes ?? obj.shiftNotes;
  const location = obj.location ? String(obj.location) : undefined;

  // GMT offset from SubItUp (e.g. "-4", "+5")
  const gmtRaw = obj.GMT ?? obj.gmt;
  const utcOffset = typeof gmtRaw === 'string' ? parseGmtOffset(gmtRaw) : null;

  // Dates: prefer milstart/milend (clean format), fall back to start/end
  const startRaw = obj.milstart ?? obj.milStart ?? obj.start ?? obj.start_time ?? obj.startTime;
  const endRaw = obj.milend ?? obj.milEnd ?? obj.end ?? obj.end_time ?? obj.endTime;

  if (!startRaw || !endRaw) return [];

  const start = normalizeDateTime(startRaw, utcOffset);
  const end = normalizeDateTime(endRaw, utcOffset);

  if (!start || !end) return [];

  const shift: Shift = {
    id: decodeURIComponent(id) || hashShift(title, start, end),
    title: title.trim(),
    location,
    start,
    end,
  };

  return [shift];
}

/**
 * Format a GMT offset number into "+HH:MM" / "-HH:MM" string.
 * e.g. -4 → "-04:00", 5.5 → "+05:30"
 */
function formatOffset(offsetHours: number): string {
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = Math.abs(offsetHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseGmtOffset(gmt: string): number | null {
  const cleaned = gmt.replace(/gmt/i, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeDateTime(value: unknown, utcOffset: number | null): string | null {
  if (!value) return null;

  if (typeof value === 'number') {
    const ts = value > 1e12 ? value : value * 1000;
    return new Date(ts).toISOString();
  }

  if (typeof value === 'string') {
    // Handle "2026-03-01 18:00:00" format (milstart/milend)
    // These are local times in the SubItUp GMT offset
    const cleaned = value.includes('T') ? value : value.replace(' ', 'T');

    if (utcOffset !== null && !cleaned.includes('Z') && !cleaned.match(/[+-]\d{2}:\d{2}$/)) {
      // Append the offset so this becomes a proper offset-aware ISO string
      // e.g. "2026-03-01T18:00:00" + "-04:00" → "2026-03-01T18:00:00-04:00"
      return cleaned + formatOffset(utcOffset);
    }

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d.toISOString();

    const d2 = new Date(value);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }

  return null;
}

function isValidShift(shift: Shift): boolean {
  return (
    shift.title.length > 0 &&
    !isNaN(new Date(shift.start).getTime()) &&
    !isNaN(new Date(shift.end).getTime()) &&
    new Date(shift.end).getTime() > new Date(shift.start).getTime()
  );
}

function hashShift(title: string, start: string, end: string): string {
  const str = `${title}|${start}|${end}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `gen_${Math.abs(hash).toString(36)}`;
}

export function computeShiftHash(shift: Shift): string {
  const str = `${shift.title}|${shift.start}|${shift.end}|${shift.location ?? ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
