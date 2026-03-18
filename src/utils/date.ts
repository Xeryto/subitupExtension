import { Shift } from '../lib/types';

export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function getTwoWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start, end };
}

export function getMonthBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function getDateRangeBounds(range: 'week' | '2weeks' | 'month'): { start: Date; end: Date } {
  switch (range) {
    case 'week': return getWeekBounds();
    case '2weeks': return getTwoWeekBounds();
    case 'month': return getMonthBounds();
  }
}

export function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const groups = new Map<string, Shift[]>();
  const sorted = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const shift of sorted) {
    const dayKey = new Date(shift.start).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const existing = groups.get(dayKey) || [];
    existing.push(shift);
    groups.set(dayKey, existing);
  }

  return groups;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'p' : 'a';
  const hour = h % 12 || 12;
  const min = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${hour}${min}${ampm}`;
}

export function formatDateRange(shifts: Shift[]): string {
  if (shifts.length === 0) return '';
  const sorted = [...shifts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const first = new Date(sorted[0].start);
  const last = new Date(sorted[sorted.length - 1].start);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${first.toLocaleDateString('en-US', opts)} – ${last.toLocaleDateString('en-US', opts)}`;
}

export function toISOString(date: Date, timezone?: string): string {
  if (!timezone) return date.toISOString();
  return date.toLocaleString('sv-SE', { timeZone: timezone }).replace(' ', 'T');
}
