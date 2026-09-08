'use client';

// Google-Calendar-style view of the class timetable. It renders the SAME
// role-scoped rows the list view uses (RLS already limits them: a teacher sees
// only their classes, a student only theirs, admin/manager everything), so no
// per-role logic is needed here beyond which action buttons show on a class.
//
// Two layouts: Month (overview grid) and Week (Google-Calendar-style time grid
// with side-by-side overlap packing for a teacher who has several classes at
// once). All day/time placement is computed in Asia/Karachi (PKT) so a class
// lands on the correct local day regardless of the viewer's browser timezone.

import React, { useMemo, useState } from 'react';
import type { ScheduledClass } from '@/lib/mockAcademicsData';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  GraduationCap,
  Video,
  Pencil,
  Trash2,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

type ViewKind = 'month' | 'week';

// A class placed on the calendar: its PKT day key + fractional start/end hours.
type DayEvent = { cls: ScheduledClass; key: string; startFrac: number; endFrac: number };

// ---- PKT (Asia/Karachi) date helpers ------------------------------------

// Break an ISO instant into its Asia/Karachi calendar fields. `key` is the
// YYYY-MM-DD day the class belongs to locally; `hour`/`minute` place it on the
// week grid. Midnight can format as hour "24" in some engines - normalise to 0.
function pktFields(iso: string): { key: string; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = dtf.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: parseInt(get('minute'), 10),
  };
}

// Today's PKT day key, used to highlight "today" in the grid.
function pktTodayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

// Calendar-date arithmetic done on UTC-midnight Dates so it never shifts a day
// across the viewer's local timezone (these represent DAYS, not instants).
function utcDate(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function addMonths(d: Date, n: number): Date {
  return utcDate(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}
function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}
// Monday-first week start (fits a Mon-Fri teaching week; weekend sits together).
function weekStartMonday(d: Date): Date {
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const back = (dow + 6) % 7; // days since Monday
  return addDays(d, -back);
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---- Event styling by class type / status --------------------------------

function eventClasses(cls: ScheduledClass): string {
  if (cls.status === 'Cancelled') {
    return 'bg-slate-100 text-slate-500 border-slate-300 line-through dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700';
  }
  if (cls.classType === 'Makeup') {
    return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/40';
  }
  if (cls.classType === 'Test') {
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40';
  }
  return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/40';
}
function eventDot(cls: ScheduledClass): string {
  if (cls.status === 'Cancelled') return 'bg-slate-400';
  if (cls.classType === 'Makeup') return 'bg-purple-500';
  if (cls.classType === 'Test') return 'bg-amber-500';
  return 'bg-blue-500';
}

// ---- Week-view overlap packing -------------------------------------------
// Group events whose times overlap and lay them side by side (colIndex/colCount)
// so a teacher's back-to-back or clashing classes stay readable, Google-style.
interface Placed {
  cls: ScheduledClass;
  startFrac: number; // hours from midnight (PKT)
  endFrac: number;
  colIndex: number;
  colCount: number;
}
function packDay(events: { cls: ScheduledClass; startFrac: number; endFrac: number }[]): Placed[] {
  const sorted = [...events].sort((a, b) => a.startFrac - b.startFrac || a.endFrac - b.endFrac);
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.colIndex + 1));
    group.forEach((g) => (g.colCount = cols));
    placed.push(...group);
    group = [];
    groupEnd = -Infinity;
  };
  for (const ev of sorted) {
    if (group.length && ev.startFrac >= groupEnd) flush();
    // First free column whose last event ends at/before this start.
    const colEnds: number[] = [];
    for (const g of group) colEnds[g.colIndex] = Math.max(colEnds[g.colIndex] ?? -Infinity, g.endFrac);
    let col = 0;
    while (col < colEnds.length && colEnds[col] > ev.startFrac) col++;
    group.push({ ...ev, colIndex: col, colCount: 1 });
    groupEnd = Math.max(groupEnd, ev.endFrac);
  }
  if (group.length) flush();
  return placed;
}

// ---- Component -----------------------------------------------------------

export function ClassCalendar({
  classes,
  canManage,
  role,
  onComplete,
  onReschedule,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  classes: ScheduledClass[];
  canManage: boolean;
  role: string;
  onComplete: (cls: ScheduledClass) => void;
  onReschedule: (cls: ScheduledClass) => void;
  onEdit: (cls: ScheduledClass) => void;
  onDelete: (cls: ScheduledClass) => void;
  // Dashboard glance: show details + Join only, no management actions.
  readOnly?: boolean;
}) {
  const [view, setView] = useState<ViewKind>('month');
  // Anchor is a UTC-midnight calendar date; the grid is derived from it.
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = pktTodayKey().split('-').map(Number);
    return utcDate(t[0], t[1] - 1, t[2]);
  });
  const [selected, setSelected] = useState<ScheduledClass | null>(null);

  const todayKey = useMemo(() => pktTodayKey(), []);

  // Pre-compute each class's PKT day key + fractional start/end once.
  const enriched = useMemo(() => {
    return classes.map((c) => {
      const startISO = c.startAtISO ?? '';
      const start = startISO ? pktFields(startISO) : { key: '', hour: 0, minute: 0 };
      const endISO = c.endAtISO ?? '';
      const end = endISO ? pktFields(endISO) : { key: start.key, hour: start.hour + 1, minute: start.minute };
      const startFrac = start.hour + start.minute / 60;
      let endFrac = end.hour + end.minute / 60;
      if (endFrac <= startFrac) endFrac = startFrac + 1; // guard 0/neg duration
      return { cls: c, key: start.key, startFrac, endFrac };
    });
  }, [classes]);

  const byDay = useMemo(() => {
    const m = new Map<string, DayEvent[]>();
    for (const e of enriched) {
      if (!e.key) continue;
      const arr = m.get(e.key) ?? [];
      arr.push(e);
      m.set(e.key, arr);
    }
    // Sort each day's events by start time.
    m.forEach((arr) => arr.sort((a, b) => a.startFrac - b.startFrac));
    return m;
  }, [enriched]);

  const goPrev = () => setAnchor((a) => (view === 'month' ? addMonths(a, -1) : addDays(a, -7)));
  const goNext = () => setAnchor((a) => (view === 'month' ? addMonths(a, 1) : addDays(a, 7)));
  const goToday = () => {
    const t = pktTodayKey().split('-').map(Number);
    setAnchor(utcDate(t[0], t[1] - 1, t[2]));
  };

  // ---- Header title --------------------------------------------------------
  const title = useMemo(() => {
    if (view === 'month') return `${MONTH_NAMES[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`;
    const ws = weekStartMonday(anchor);
    const we = addDays(ws, 6);
    const sameMonth = ws.getUTCMonth() === we.getUTCMonth();
    const fmt = (d: Date, withMonth: boolean) =>
      `${withMonth ? MONTH_NAMES[d.getUTCMonth()].slice(0, 3) + ' ' : ''}${d.getUTCDate()}`;
    return sameMonth
      ? `${MONTH_NAMES[ws.getUTCMonth()].slice(0, 3)} ${ws.getUTCDate()} – ${we.getUTCDate()}, ${we.getUTCFullYear()}`
      : `${fmt(ws, true)} – ${fmt(we, true)}, ${we.getUTCFullYear()}`;
  }, [view, anchor]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-[#EBEDF3] dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="h-[34px] px-3 rounded-xl border border-[#EBEDF3] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center">
            <button onClick={goPrev} aria-label="Previous" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goNext} aria-label="Next" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h2 className="font-heading font-medium text-lg text-slate-900 dark:text-white ml-1">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 text-[11px] font-medium text-[#6B7185] dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Class</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Makeup</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Test</span>
          </div>
          {/* View switch */}
          <div className="flex items-center gap-1 bg-[#F6F7FB] dark:bg-slate-800 p-1 rounded-xl">
            {(['month', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  view === v ? 'bg-[#5B47D6] text-white shadow-sm' : 'text-[#6B7185] hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID */}
      {view === 'month' ? (
        <MonthGrid anchor={anchor} byDay={byDay} todayKey={todayKey} onSelect={setSelected} />
      ) : (
        <WeekGrid anchor={anchor} byDay={byDay} todayKey={todayKey} onSelect={setSelected} />
      )}

      {/* EVENT DETAIL MODAL */}
      {selected && (
        <EventDetail
          cls={selected}
          canManage={canManage}
          role={role}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onComplete={onComplete}
          onReschedule={onReschedule}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ---- Month grid ----------------------------------------------------------

function MonthGrid({
  anchor,
  byDay,
  todayKey,
  onSelect,
}: {
  anchor: Date;
  byDay: Map<string, DayEvent[]>;
  todayKey: string;
  onSelect: (c: ScheduledClass) => void;
}) {
  const firstOfMonth = utcDate(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1);
  const gridStart = weekStartMonday(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const curMonth = anchor.getUTCMonth();
  const MAX_CHIPS = 3;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        {/* weekday header */}
        <div className="grid grid-cols-7 border-b border-[#EBEDF3] dark:border-slate-800">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-[#6B7185] dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>
        {/* 6 rows */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const key = dayKey(cell);
            const inMonth = cell.getUTCMonth() === curMonth;
            const isToday = key === todayKey;
            const events = byDay.get(key) ?? [];
            return (
              <div
                key={i}
                className={`min-h-[104px] border-b border-r border-[#F1F2F7] dark:border-slate-800 p-1.5 ${
                  inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/60 dark:bg-slate-950/40'
                } ${i % 7 === 0 ? 'border-l' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-medium h-6 w-6 rounded-full ${
                      isToday
                        ? 'bg-[#5B47D6] text-white'
                        : inMonth
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {cell.getUTCDate()}
                  </span>
                  {events.length > 0 && (
                    <span className="text-[10px] font-medium text-[#6B7185] dark:text-slate-500">{events.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {events.slice(0, MAX_CHIPS).map((e) => (
                    <button
                      key={e.cls.id}
                      onClick={() => onSelect(e.cls)}
                      title={`${e.cls.startAt} · ${e.cls.subject}${e.cls.studentName ? ` · ${e.cls.studentName}` : ''}`}
                      className={`w-full text-left truncate px-1.5 py-0.5 rounded-md border text-[11px] font-medium leading-tight ${eventClasses(
                        e.cls
                      )}`}
                    >
                      <span className="font-mono opacity-80">{e.cls.startAt.replace(/\s?(am|pm)/i, '')}</span>{' '}
                      {e.cls.subject || 'Class'}
                    </button>
                  ))}
                  {events.length > MAX_CHIPS && (
                    <button
                      onClick={() => onSelect(events[MAX_CHIPS].cls)}
                      className="w-full text-left text-[11px] font-medium text-[#5B47D6] hover:underline px-1.5"
                    >
                      +{events.length - MAX_CHIPS} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Week grid -----------------------------------------------------------

function WeekGrid({
  anchor,
  byDay,
  todayKey,
  onSelect,
}: {
  anchor: Date;
  byDay: Map<string, DayEvent[]>;
  todayKey: string;
  onSelect: (c: ScheduledClass) => void;
}) {
  const ws = weekStartMonday(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const HOUR_PX = 48;

  // Time window: fit the week's events, default 8:00–20:00, pad 1h, clamp 0–24.
  const { winStart, winEnd } = useMemo(() => {
    let min = 8;
    let max = 20;
    for (const d of days) {
      for (const e of byDay.get(dayKey(d)) ?? []) {
        min = Math.min(min, Math.floor(e.startFrac));
        max = Math.max(max, Math.ceil(e.endFrac));
      }
    }
    return { winStart: Math.max(0, min - 1), winEnd: Math.min(24, Math.max(max + 1, min + 4)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, byDay]);

  const hours = Array.from({ length: winEnd - winStart }, (_, i) => winStart + i);
  const fmtHour = (h: number) => {
    const ampm = h < 12 || h === 24 ? 'AM' : 'PM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${ampm}`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        {/* day header row */}
        <div className="grid border-b border-[#EBEDF3] dark:border-slate-800" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div />
          {days.map((d, i) => {
            const isToday = dayKey(d) === todayKey;
            return (
              <div key={i} className="py-2 text-center border-l border-[#F1F2F7] dark:border-slate-800">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#6B7185] dark:text-slate-400">
                  {WEEKDAY_LABELS[i]}
                </div>
                <div
                  className={`mt-0.5 inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium ${
                    isToday ? 'bg-[#5B47D6] text-white' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {d.getUTCDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* time grid */}
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* hour gutter */}
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="text-right pr-2 text-[10px] font-medium text-[#6B7185] dark:text-slate-500" style={{ height: HOUR_PX }}>
                <span className="relative -top-1.5">{fmtHour(h)}</span>
              </div>
            ))}
          </div>
          {/* day columns */}
          {days.map((d, i) => {
            const events = byDay.get(dayKey(d)) ?? [];
            const placed = packDay(events);
            return (
              <div
                key={i}
                className="relative border-l border-[#F1F2F7] dark:border-slate-800"
                style={{ height: hours.length * HOUR_PX }}
              >
                {/* hour lines */}
                {hours.map((h) => (
                  <div key={h} className="border-b border-[#F1F2F7] dark:border-slate-800/70" style={{ height: HOUR_PX }} />
                ))}
                {/* events */}
                {placed.map((p) => {
                  const top = (p.startFrac - winStart) * HOUR_PX;
                  const height = Math.max(22, (p.endFrac - p.startFrac) * HOUR_PX - 2);
                  const widthPct = 100 / p.colCount;
                  const leftPct = p.colIndex * widthPct;
                  return (
                    <button
                      key={p.cls.id}
                      onClick={() => onSelect(p.cls)}
                      title={`${p.cls.startAt}–${p.cls.endAt} · ${p.cls.subject}`}
                      className={`absolute rounded-lg border px-1.5 py-1 text-left overflow-hidden text-[11px] font-medium leading-tight ${eventClasses(
                        p.cls
                      )}`}
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <div className="truncate font-semibold">{p.cls.subject || 'Class'}</div>
                      <div className="truncate opacity-80">
                        {p.cls.studentName || p.cls.teacherName}
                      </div>
                      <div className="truncate font-mono opacity-70">{p.cls.startAt}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Event detail modal --------------------------------------------------

function EventDetail({
  cls,
  canManage,
  role,
  readOnly,
  onClose,
  onComplete,
  onReschedule,
  onEdit,
  onDelete,
}: {
  cls: ScheduledClass;
  canManage: boolean;
  role: string;
  readOnly?: boolean;
  onClose: () => void;
  onComplete: (c: ScheduledClass) => void;
  onReschedule: (c: ScheduledClass) => void;
  onEdit: (c: ScheduledClass) => void;
  onDelete: (c: ScheduledClass) => void;
}) {
  const act = (fn: (c: ScheduledClass) => void) => () => {
    onClose();
    fn(cls);
  };
  const canAct = !readOnly && role !== 'student';
  const isOpen = cls.status !== 'Completed' && cls.status !== 'Cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${eventDot(cls)}`} />
            <h3 className="font-heading font-medium text-lg text-slate-900 dark:text-white">{cls.subject || 'Class'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-2.5 text-sm">
          <Row icon={<CalendarIcon className="w-4 h-4 text-[#5B47D6]" />} label={cls.date} />
          <Row icon={<Clock className="w-4 h-4 text-[#5B47D6]" />} label={`${cls.startAt} – ${cls.endAt}`} />
          {cls.studentName && <Row icon={<GraduationCap className="w-4 h-4 text-[#5B47D6]" />} label={cls.studentName} />}
          <Row icon={<User className="w-4 h-4 text-[#5B47D6]" />} label={cls.teacherName} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${eventClasses(cls)}`}
            >
              {cls.classType}
              {!cls.isCharged && ' · Free'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {cls.status}
            </span>
          </div>
          {cls.classNote && (
            <p className="text-xs text-[#6B7185] dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 leading-relaxed">
              {cls.classNote}
            </p>
          )}
        </div>

        {/* Join link (everyone) */}
        {cls.meetingLink && (
          <a
            href={cls.meetingLink}
            target="_blank"
            rel="noreferrer"
            className="w-full h-[40px] rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Video className="w-4 h-4" /> Join Google Meet
          </a>
        )}

        {/* Management actions (not students) */}
        {canAct && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[#EBEDF3] dark:border-slate-800 mt-1 pt-3">
            <button
              onClick={act(onComplete)}
              className="flex-1 min-w-[130px] h-[38px] rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {cls.status === 'Completed' ? 'View Attendance' : 'Complete Class'}
            </button>
            {isOpen && (
              <button
                onClick={act(onReschedule)}
                className="h-[38px] px-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-medium flex items-center gap-1.5 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30"
              >
                <RotateCcw className="w-4 h-4" /> Reschedule
              </button>
            )}
            {canManage && (
              <>
                <button
                  onClick={act(onEdit)}
                  aria-label="Edit class"
                  className="h-[38px] w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={act(onDelete)}
                  aria-label="Delete class"
                  className="h-[38px] w-[38px] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  );
}
