'use client';

// Admin dashboard content (renders inside PortalLayout - app sidebar untouched).
// Real data via getAdminDashboard(). All filters + buttons are functional. The
// classes block has a day navigator (prev/today/next + date picker) and detects
// missed classes + whether a makeup was scheduled on another day.
import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import type { AdminData, AdminClass, SystemHealth } from '@/lib/data/adminDashboard';
import {
  Calendar, Target, AlertTriangle, Video, UserPlus, Heart, Users,
  Download, RefreshCw, ClipboardCheck, ChevronLeft, ChevronRight,
  Activity, Bell, CalendarClock, Mail,
} from 'lucide-react';

const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

function useCountUp(value: number, run = true) {
  const [n, setN] = useState(run ? 0 : value);
  useEffect(() => {
    if (!run) { setN(value); return; }
    let raf = 0; const start = performance.now(); const dur = 650;
    const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return n;
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; };
const todayLine = () => {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${d.getDate()} ${mon[d.getMonth()]}`;
};
const fmtDay = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
const shiftDay = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const Sel = ({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) => (
  <div className="relative inline-flex items-center">
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="appearance-none cursor-pointer rounded-[9px] border border-[#e0e3ee] bg-white pl-3 pr-8 py-2 text-[13px] font-medium text-[#3b4258] hover:border-[#c9cee0] focus:outline-none focus:border-[#5b47d6]">
      <option value={`All ${label}`}>{`All ${label}`}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
    <svg className="pointer-events-none absolute right-2.5 h-4 w-4 text-[#98a0bd]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
  </div>
);
const Seg = ({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: { k: string; label: string }[] }) => (
  <div className="inline-flex rounded-lg bg-[#f2f3f8] p-[3px]">
    {opts.map((o) => <button key={o.k} onClick={() => onChange(o.k)} className={cls('rounded-md px-3 py-1 text-[12px] font-medium transition-colors', value === o.k ? 'bg-white text-[#0f1729] shadow-sm' : 'text-[#6b7391]')}>{o.label}</button>)}
  </div>
);
const Card = ({ children, i = 0, className = '' }: { children: React.ReactNode; i?: number; className?: string }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
    className={cls('rounded-2xl border border-[#eaecf3] bg-white p-4 transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(23,28,60,.28)]', className)}>{children}</motion.div>
);
const SecH = ({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h3 className="m-0 flex items-center gap-2 text-[16px] font-medium text-[#0f1729]">{title}</h3>{right}
  </div>
);

// System-health heartbeat: catches SILENT failures (cron stopped, calendar token
// lapsed, email not configured) that otherwise go unnoticed until parents complain.
type HealthTone = 'green' | 'amber' | 'red';
const TONE_BG: Record<HealthTone, string> = { green: 'bg-[#e6f7ee] text-[#0f8a44]', amber: 'bg-[#fdf3e2] text-[#b06a06]', red: 'bg-[#fdecef] text-[#c8384f]' };
const DOT: Record<HealthTone, string> = { green: 'bg-[#11a256]', amber: 'bg-[#d9820a]', red: 'bg-[#e0435a]' };

function HealthPill({ tone, icon, label, detail }: { tone: HealthTone; icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div className={cls('flex items-center gap-2.5 rounded-xl px-3 py-2', TONE_BG[tone])}>
      <span className="flex-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium leading-tight">{label}</div>
        <div className="text-[11.5px] font-medium opacity-80 leading-tight truncate">{detail}</div>
      </div>
    </div>
  );
}

function HealthStrip({ health }: { health: SystemHealth }) {
  const fmtAgo = (m: number | null) => (m == null ? '' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`);
  const notifTone: HealthTone = health.cronStuck || health.failed > 0 ? 'red' : health.queued > 0 ? 'amber' : 'green';
  const notifDetail = health.cronStuck
    ? `Cron not running · ${health.queued} unsent for ${fmtAgo(health.oldestQueuedMins)}`
    : health.failed > 0 ? `${health.failed} failed · ${health.queued} queued`
    : health.queued > 0 ? `${health.queued} queued · draining`
    : `${health.sent24h} sent in 24h`;

  const calTone: HealthTone = !health.calendarConfigured ? 'red' : (health.classesMissingLink + health.demosMissingLink > 0 ? 'amber' : 'green');
  const calDetail = !health.calendarConfigured ? 'Google Calendar not connected'
    : (health.classesMissingLink + health.demosMissingLink > 0)
      ? `${health.classesMissingLink} classes · ${health.demosMissingLink} demos missing a link`
      : 'Invites sending';

  const emailTone: HealthTone = !health.emailConfigured ? 'red' : (health.failed > 0 ? 'amber' : 'green');
  const emailDetail = !health.emailConfigured ? 'Resend API key / from-address not set' : health.failed > 0 ? 'Some sends failing' : 'Delivery OK';

  const worst: HealthTone = [notifTone, calTone, emailTone].includes('red') ? 'red' : [notifTone, calTone, emailTone].includes('amber') ? 'amber' : 'green';

  return (
    <Card i={0} className={cls(worst === 'red' && '!border-[#f3cdd4]', worst === 'amber' && '!border-[#f4e2c0]')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-medium text-[#0f1729]"><Activity className="h-[18px] w-[18px] text-[#5b47d6]" />System health</div>
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#6b7391]">
          <span className={cls('h-2 w-2 rounded-full', DOT[worst])} />
          {worst === 'green' ? 'All systems operational' : worst === 'amber' ? 'Needs attention' : 'Action required'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <HealthPill tone={notifTone} icon={<Bell className="h-4 w-4" />} label="Notifications" detail={notifDetail} />
        <HealthPill tone={calTone} icon={<CalendarClock className="h-4 w-4" />} label="Calendar invites" detail={calDetail} />
        <HealthPill tone={emailTone} icon={<Mail className="h-4 w-4" />} label="Email delivery" detail={emailDetail} />
      </div>
    </Card>
  );
}

export function AdminDashboard({ data, role = 'admin' }: { data: AdminData; role?: 'admin' | 'manager' }) {
  const router = useRouter();
  const isManager = role === 'manager';
  const [range, setRange] = useState('This week');
  const [program, setProgram] = useState('All programs');
  const [teacher, setTeacher] = useState('All teachers');
  const [subject, setSubject] = useState('All subjects');
  const [source, setSource] = useState('All sources');
  const [classView, setClassView] = useState('all');
  const [attnUrgent, setAttnUrgent] = useState('all');
  const [availOnly, setAvailOnly] = useState('all');
  const [selDate, setSelDate] = useState(data.todayISO);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rangeDays = range === 'Today' ? 0 : range === 'This week' ? 7 : range === 'This month' ? 31 : 120;
  const matchG = (p?: string, t?: string, s?: string) =>
    (program === 'All programs' || p === program) && (teacher === 'All teachers' || t === teacher) && (subject === 'All subjects' || s === subject);

  const dayClasses = useMemo(() => data.classes.filter((c) =>
    c.dateISO === selDate && matchG(c.program, c.teacher, c.subject) &&
    (classView === 'all' || c.status === classView)
  ), [data.classes, selDate, program, teacher, subject, classView]);

  const findMakeup = (c: AdminClass) => data.classes.find((x) => x.id !== c.id && x.studentId === c.studentId && x.subjectId === c.subjectId && new Date(x.startISO).getTime() > new Date(c.endISO).getTime());

  const leads = useMemo(() => data.leads.filter((l) =>
    (program === 'All programs' || l.program === program) && (source === 'All sources' || l.source === source) && l.createdDaysAgo <= rangeDays
  ), [data.leads, program, source, rangeDays]);

  const teachers = useMemo(() => data.teachers.filter((t) =>
    (teacher === 'All teachers' || t.name === teacher) && (availOnly === 'all' || t.load < t.capacity)
  ), [data.teachers, teacher, availOnly]);

  const attention = useMemo(() => data.attention.filter((a) =>
    (attnUrgent === 'all' || a.severity === 'high') && (program === 'All programs' || !a.program || a.program === program) &&
    (!isManager || a.kind !== 'overdue')
  ), [data.attention, attnUrgent, program, isManager]);

  const funnel = useMemo(() => {
    const L = leads.length, C = leads.filter((l) => l.stage !== 'new').length, D = leads.filter((l) => l.stage === 'demo' || l.stage === 'won').length, W = leads.filter((l) => l.stage === 'won').length;
    const p = (n: number) => (L ? Math.round((n / L) * 100) : 0);
    return { L, C, D, W, cW: p(C), dW: p(D), wW: p(W) };
  }, [leads]);

  const cToday = useCountUp(data.kpis.classesToday, mounted);
  const cDemos = useCountUp(data.kpis.demosToAssign, mounted);
  const cLeads = useCountUp(data.kpis.newLeadsToday, mounted);
  const cRisk = useCountUp(data.kpis.atRisk, mounted);
  const cActive = useCountUp(data.kpis.activeStudents, mounted);

  const reset = () => { setRange('This week'); setProgram('All programs'); setTeacher('All teachers'); setSubject('All subjects'); setSource('All sources'); setSelDate(data.todayISO); };
  const exportCsv = () => {
    const rows = [['Date', 'Time', 'Subject', 'Student', 'Teacher', 'Status'], ...dayClasses.map((c) => [c.dateISO, c.time, c.subject, c.student, c.teacher, c.status])];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `classes-${selDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const chip = 'inline-flex items-center gap-1.5 rounded-[9px] border border-[#e0e3ee] bg-white px-3 py-2 text-[13px] font-medium text-[#6b7391] cursor-pointer hover:border-[#c9cee0]';

  return (
    <div style={{ fontFamily: 'var(--font-dmsans, var(--font-inter), system-ui)' }} className="space-y-4 text-[15px] text-[#0f1729]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[24px] font-medium tracking-tight">{greeting()}, Admin</h2>
          <div className="mt-0.5 text-[14px] text-[#6b7391]">{todayLine()} · here is what needs you today.</div>
        </div>
      </div>

      {(data.kpis.demosToAssign > 0 || data.fees.overdue > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="relative flex flex-wrap items-center gap-3.5 overflow-hidden rounded-2xl border border-[#f4cdd4] bg-white px-4 py-3.5">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#e0435a]" />
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#fdecef] text-[#e0435a]"><AlertTriangle className="h-5 w-5" /></span>
          <div className="text-[14px]"><b className="font-medium">{data.kpis.demosToAssign} demos need a teacher</b> <span className="text-[#6b7391]">· {data.attention.some((a) => a.kind === 'overdue') ? 'fees overdue' : 'all fees on track'}</span></div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => router.push('/demos?new=1')} className="rounded-[9px] bg-[#e0435a] px-4 py-2 text-[13px] font-medium text-white">Assign demos</button>
            <button onClick={() => router.push('/vouchers')} className="rounded-[9px] border border-[#e0e3ee] bg-white px-4 py-2 text-[13px] font-medium text-[#3b4258]">Review fees</button>
          </div>
        </motion.div>
      )}

      <HealthStrip health={data.health} />

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#eaecf3] bg-white p-2.5">
        <Seg value={range} onChange={setRange} opts={[{ k: 'Today', label: 'Today' }, { k: 'This week', label: 'Week' }, { k: 'This month', label: 'Month' }, { k: 'This term', label: 'Term' }]} />
        <Sel label="programs" value={program} onChange={setProgram} opts={data.options.programs} />
        <Sel label="teachers" value={teacher} onChange={setTeacher} opts={data.options.teachers} />
        <Sel label="subjects" value={subject} onChange={setSubject} opts={data.options.subjects} />
        <Sel label="sources" value={source} onChange={setSource} opts={data.options.sources} />
        <div className="flex-1" />
        <button onClick={reset} className={chip}><RefreshCw className="h-4 w-4" />Reset</button>
        <button onClick={exportCsv} className={chip}><Download className="h-4 w-4" />Export</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { l: 'Classes today', v: cToday, icon: <Calendar className="h-[18px] w-[18px]" />, ic: 'bg-[#efedfe] text-[#5b47d6]', to: '/schedule' },
          { l: 'Demos to assign', v: cDemos, hot: data.kpis.demosToAssign > 0, icon: <UserPlus className="h-[18px] w-[18px]" />, ic: 'bg-[#fdf3e2] text-[#d9820a]', to: '/demos' },
          { l: 'New leads today', v: cLeads, icon: <Target className="h-[18px] w-[18px]" />, ic: 'bg-[#eaf1ff] text-[#2f6df6]', to: '/leads' },
          { l: 'Students at risk', v: cRisk, hot: data.kpis.atRisk > 0, icon: <Heart className="h-[18px] w-[18px]" />, ic: 'bg-[#fdecef] text-[#e0435a]', to: '/students' },
          isManager
            ? { l: 'Active students', v: cActive, icon: <Users className="h-[18px] w-[18px]" />, ic: 'bg-[#e6f7ee] text-[#11a256]', to: '/students' }
            : { l: 'Overdue fees', v: `Rs ${Math.round(data.fees.overdue / 1000)}k`, hot: data.fees.overdue > 0, icon: <AlertTriangle className="h-[18px] w-[18px]" />, ic: 'bg-[#fdecef] text-[#e0435a]', to: '/vouchers' },
        ].map((k: any, i) => (
          <Card key={k.l} i={i} className={cls('cursor-pointer', k.hot && '!border-[#f3cdd4]')}>
            <div onClick={() => router.push(k.to)}>
              <span className={cls('mb-3 flex h-9 w-9 items-center justify-center rounded-[10px]', k.ic)}>{k.icon}</span>
              <div className="text-[13px] font-medium text-[#6b7391]">{k.l}</div>
              <div className={cls('mt-0.5 text-[27px] font-medium tracking-tight tabular-nums', k.hot && 'text-[#e0435a]')}>{k.v}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* hero: classes (with day navigator) + attention */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card i={5} className="lg:col-span-7">
          <SecH title={<><Calendar className="h-5 w-5 text-[#5b47d6]" />Classes</>} right={
            <div className="flex items-center gap-2">
              <button onClick={() => setSelDate(shiftDay(selDate, -1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e3ee] text-[#6b7391] hover:bg-[#f6f7fb]"><ChevronLeft className="h-4 w-4" /></button>
              <input type="date" value={selDate} onChange={(e) => setSelDate(e.target.value)} className="rounded-lg border border-[#e0e3ee] px-2 py-1.5 text-[13px] font-medium text-[#3b4258]" />
              <button onClick={() => setSelDate(shiftDay(selDate, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e3ee] text-[#6b7391] hover:bg-[#f6f7fb]"><ChevronRight className="h-4 w-4" /></button>
              {selDate !== data.todayISO && <button onClick={() => setSelDate(data.todayISO)} className="rounded-lg bg-[#f6f4ff] px-3 py-1.5 text-[12px] font-medium text-[#5b47d6]">Today</button>}
            </div>} />
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-medium text-[#6b7391]">{fmtDay(selDate)}{selDate === data.todayISO ? ' (today)' : ''}</div>
            <Seg value={classView} onChange={setClassView} opts={[{ k: 'all', label: 'All' }, { k: 'live', label: 'Live' }, { k: 'upcoming', label: 'Upcoming' }, { k: 'missed', label: 'Missed' }]} />
          </div>
          {dayClasses.length === 0 && <div className="py-8 text-center text-[13px] text-[#98a0bd]">No classes on this day for these filters.</div>}
          {dayClasses.map((c) => {
            const mk = c.status === 'missed' ? findMakeup(c) : undefined;
            return (
              <div key={c.id} className={cls('mb-2.5 rounded-xl border p-3', c.status === 'live' ? 'border-[#bfe6d0] bg-[#f2fbf6]' : c.status === 'missed' ? 'border-[#f3cdd4] bg-[#fef8f9]' : 'border-[#eaecf3]')}>
                <div className="flex items-center gap-3">
                  <div className={cls('w-[54px] text-center text-[15px] font-medium', c.status === 'live' && 'text-[#11a256]', c.status === 'missed' && 'text-[#e0435a]')}>{c.status === 'live' ? 'Now' : c.time}</div>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium">{c.subject} · {c.student}</div>
                    <div className="text-[12.5px] text-[#6b7391]">{c.teacher}{c.type === 'makeup' ? ' · makeup class' : ''}{c.status === 'completed' ? ' · attendance marked' : ''}{c.status === 'missed' ? (mk ? ` · rescheduled to ${mk.dateISO}` : ' · not rescheduled') : ''}</div>
                  </div>
                  {c.status === 'completed' ? <span className="rounded-full bg-[#e6f7ee] px-2.5 py-1 text-[12px] font-medium text-[#11a256]">Done</span>
                    : c.status === 'missed' ? (mk ? <span className="rounded-full bg-[#eef0f7] px-2.5 py-1 text-[12px] font-medium text-[#6b7391]">Rescheduled</span> : <button onClick={() => router.push('/schedule')} className="rounded-lg bg-[#fdecef] px-3 py-1.5 text-[12px] font-medium text-[#e0435a]">Reschedule</button>)
                      : c.meetingLink ? <button onClick={() => window.open(c.meetingLink, '_blank')} className={cls('ml-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium', c.status === 'live' ? 'bg-[#5b47d6] text-white' : 'bg-[#f6f4ff] text-[#5b47d6]')}><Video className="h-4 w-4" />Join</button>
                        : <span className="ml-auto rounded-full bg-[#fdf3e2] px-2.5 py-1 text-[12px] font-medium text-[#d9820a]">No invite</span>}
                </div>
              </div>
            );
          })}
        </Card>

        <Card i={6} className="lg:col-span-5">
          <SecH title={<><AlertTriangle className="h-5 w-5 text-[#e0435a]" />Needs attention</>} right={<Seg value={attnUrgent} onChange={setAttnUrgent} opts={[{ k: 'all', label: 'All' }, { k: 'urgent', label: 'Urgent' }]} />} />
          {attention.length === 0 && <div className="py-8 text-center text-[13px] text-[#98a0bd]">Nothing needs attention right now.</div>}
          {attention.map((a) => {
            const ic = a.kind === 'demo' ? 'bg-[#fdf3e2] text-[#d9820a]' : a.kind === 'overdue' || a.kind === 'atrisk' ? 'bg-[#fdecef] text-[#e0435a]' : 'bg-[#efedfe] text-[#5b47d6]';
            const Icon = a.kind === 'demo' ? UserPlus : a.kind === 'atrisk' ? Heart : a.kind === 'unmarked' ? ClipboardCheck : AlertTriangle;
            return (
              <div key={a.id} className={cls('mb-2 flex items-center gap-2.5 rounded-xl border p-2.5', a.severity === 'high' ? 'border-[#f3cdd4] bg-[#fef8f9]' : 'border-[#eaecf3]')}>
                <span className={cls('flex h-8 w-8 flex-none items-center justify-center rounded-[9px]', ic)}><Icon className="h-[18px] w-[18px]" /></span>
                <div className="flex-1"><div className="text-[14px] font-medium">{a.title}</div><div className="text-[12.5px] text-[#6b7391]">{a.sub}</div></div>
                <button onClick={() => router.push(a.href)} className="ml-auto rounded-lg bg-[#f6f4ff] px-3 py-1.5 text-[12.5px] font-medium text-[#5b47d6]">{a.action}</button>
              </div>
            );
          })}
        </Card>
      </div>

      {/* secondary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card i={7} className={isManager ? 'lg:col-span-6' : 'lg:col-span-5'}>
          <SecH title="New leads and funnel" right={<span className="text-[13px] text-[#6b7391]">{leads.length} in range</span>} />
          <div className="flex flex-col gap-2">
            {[{ label: 'Leads', n: funnel.L, w: 100, bg: '#5b47d6', m: '' }, { label: 'Contacted', n: funnel.C, w: funnel.cW, bg: '#6f5fe0', m: `${funnel.cW}%` }, { label: 'Demos', n: funnel.D, w: funnel.dW, bg: '#8878ea', m: `${funnel.dW}%` }, { label: 'Won', n: funnel.W, w: funnel.wW, bg: '#11a256', m: `${funnel.wW}%` }].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(f.w, 16)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className="flex h-8 items-center rounded-md px-3 text-[12.5px] font-medium text-white" style={{ background: f.bg }}>{f.label}</motion.div>
                <span className="whitespace-nowrap text-[12.5px] text-[#6b7391]"><b className="text-[#0f1729]">{f.n}</b>{f.m && ` · ${f.m}`}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card i={8} className={isManager ? 'lg:col-span-6' : 'lg:col-span-4'}>
          <SecH title="Teacher availability" right={<Seg value={availOnly} onChange={setAvailOnly} opts={[{ k: 'all', label: 'All' }, { k: 'available', label: 'Available' }]} />} />
          {teachers.length === 0 && <div className="py-6 text-center text-[13px] text-[#98a0bd]">No teachers to show.</div>}
          {teachers.map((t) => {
            const pct = t.capacity ? Math.round((t.load / t.capacity) * 100) : 0;
            return (
              <div key={t.id} className="flex items-center gap-3 border-b border-[#eaecf3] py-2.5 last:border-0">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#efedfe] text-[11px] font-medium text-[#5b47d6]">{t.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span>
                <div className="flex-1 text-[13.5px] font-medium">{t.name}</div>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eef0f6]"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} className="block h-full rounded-full" style={{ background: pct >= 85 ? '#d9820a' : '#11a256' }} /></div>
                <span className="w-10 text-right text-[12.5px] tabular-nums text-[#6b7391]">{t.load}/{t.capacity}</span>
              </div>
            );
          })}
        </Card>

        {!isManager && <Card i={9} className="lg:col-span-3">
          <SecH title="Fees" right={<span className="text-[13px] text-[#6b7391]">Month</span>} />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#f8f9fc] p-3"><div className="text-[12px] text-[#6b7391]">Overdue</div><div className="mt-0.5 text-[18px] font-medium text-[#e0435a]">Rs {Math.round(data.fees.overdue / 1000)}k</div></div>
            <div className="rounded-xl bg-[#f8f9fc] p-3"><div className="text-[12px] text-[#6b7391]">Outstanding</div><div className="mt-0.5 text-[18px] font-medium text-[#d9820a]">Rs {Math.round(data.fees.outstanding / 1000)}k</div></div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12.5px]"><span className="text-[#6b7391]">Collection</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f6]"><motion.i initial={{ width: 0 }} animate={{ width: `${data.fees.collectionPct}%` }} transition={{ duration: 0.8 }} className="block h-full rounded-full bg-[#11a256]" /></div><b className="tabular-nums">{data.fees.collectionPct}%</b></div>
        </Card>}
      </div>
    </div>
  );
}
