import { Shift } from './types';

/**
 * Parse SubItUp schedule API responses into normalized Shift[].
 * SubItUp's internal API returns schedule data in various formats —
 * this handles the known structures from their /schedules and /shifts endpoints.
 */
export function parseSubItUpResponse(data: unknown): Shift[] {
  if (!data || typeof data !== 'object') return [];

  // Handle array of shifts directly
  if (Array.isArray(data)) {
    return data.flatMap(item => parseShiftItem(item)).filter(isValidShift);
  }

  const obj = data as Record<string, unknown>;

  // Handle { shifts: [...] } wrapper
  if (Array.isArray(obj.shifts)) {
    return obj.shifts.flatMap(item => parseShiftItem(item)).filter(isValidShift);
  }

  // Handle { data: [...] } wrapper
  if (Array.isArray(obj.data)) {
    return obj.data.flatMap(item => parseShiftItem(item)).filter(isValidShift);
  }

  // Handle { schedule: { shifts: [...] } }
  if (obj.schedule && typeof obj.schedule === 'object') {
    const schedule = obj.schedule as Record<string, unknown>;
    if (Array.isArray(schedule.shifts)) {
      return schedule.shifts.flatMap(item => parseShiftItem(item)).filter(isValidShift);
    }
  }

  // Handle nested date-keyed structure: { "2024-03-17": [...shifts] }
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

  const id = String(obj.id ?? obj.shift_id ?? obj.shiftId ?? '');
  const title = String(
    obj.position_name ?? obj.positionName ?? obj.title ?? obj.position ?? obj.name ?? 'Shift'
  );
  const location = obj.location ? String(obj.location) : undefined;

  // Try various date field names
  const startRaw = obj.start ?? obj.start_time ?? obj.startTime ?? obj.start_date ?? obj.startDate;
  const endRaw = obj.end ?? obj.end_time ?? obj.endTime ?? obj.end_date ?? obj.endDate;

  if (!startRaw || !endRaw) return [];

  const start = normalizeDateTime(startRaw);
  const end = normalizeDateTime(endRaw);

  if (!start || !end) return [];

  return [{ id: id || hashShift(title, start, end), title, location, start, end }];
}

function normalizeDateTime(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'number') {
    // Unix timestamp (seconds or ms)
    const ts = value > 1e12 ? value : value * 1000;
    return new Date(ts).toISOString();
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
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
