import React from 'react';
import { Shift } from '../../lib/types';
import { groupByDay, formatTime } from '../../utils/date';
import { Calendar, MapPin } from 'lucide-react';

interface Props {
  shifts: Shift[];
  loading: boolean;
}

export function ShiftList({ shifts, loading }: Props) {
  if (loading) {
    return (
      <div className="px-4 py-2 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-primary/15 rounded animate-pulse w-28" />
            <div className="h-10 bg-primary/10 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Calendar size={32} className="mx-auto text-text/30 mb-2" />
        <p className="text-sm text-text/50">No shifts detected</p>
        <p className="text-xs text-text/30 mt-1">
          Visit your SubItUp schedule to capture shifts
        </p>
      </div>
    );
  }

  const groups = groupByDay(shifts);

  return (
    <div className="px-4 py-2 space-y-1">
      {Array.from(groups.entries()).map(([day, dayShifts]) => (
        <div key={day}>
          <p className="text-xs font-semibold text-text/50 uppercase tracking-wider py-1.5">
            {day}
          </p>
          <div className="space-y-1">
            {dayShifts.map((shift, idx) => (
              <div
                key={shift.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  idx % 2 === 0 ? 'bg-white/60' : 'bg-white/30'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{shift.title}</p>
                  {shift.location && (
                    <p className="text-xs text-text/40 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      <span className="truncate">{shift.location}</span>
                    </p>
                  )}
                </div>
                <p className="text-xs font-medium text-primary whitespace-nowrap ml-2">
                  {formatTime(shift.start)}–{formatTime(shift.end)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
