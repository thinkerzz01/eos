'use client';

// Admin dashboard - bento "command center". Real data via getAdminDashboard().
// Every filter drives the panels; KPI tiles that come from the loaded window
// (leads, classes, needs-action) recompute live. Charts are ApexCharts (loaded
// client-side only). Entrance/hover motion via `motion` (already in the bundle);
// count-up is a rAF hook. Colours follow the portal palette below.
import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import type { AdminData, AdminClass, SystemHealth } from '@/lib/data/adminDashboard';
import {
  Calendar, Target, AlertTriangle, Video, UserPlus, Heart, Users,
  Download, RefreshCw, ClipboardCheck, ChevronLeft, ChevronRight,
  Activity, Bell, CalendarClock, Mail, Zap, TrendingUp, Wallet,
} from 'lucide-react';

// ApexCharts touches `window`, so it must never render on the server.
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

// Portal palette (light theme, matches the rest of the app).
const C = {
  purple: '#5b47d6', purpleSoft: '#8878ea', blue: '#2f6df6', green: '#11a256',
  amber: '#d9820a', red: '#e0435a', ink: '#0f1729', muted: '#6b7391',
  grid: '#eef0f6', border: '#eaecf3',
};

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

const fmtDay = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
const shiftDay = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const rsK = (n: number) => `Rs ${Math.round(n / 1000)}k`;

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
  <motion.div initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.42, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
    className={cls('rounded-2xl border border-[#eaecf3] bg-white p-4 transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(23,28,60,.28)]', className)}>{children}</motion.div>
);
const SecH = ({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h3 className="m-0 flex items-center gap-2 text-[16px] font-medium text-[#0f1729]">{title}</h3>{right}
  </div>
);

// -- System-health heartbeat (catches silent cron / calendar / email failures) --
type HealthTone = 'green' | 'amber' | 'red';
const TONE_BG: Record<HealthTone, string> = { green: 'bg-[#e6f7ee] text-[#0f8a44]', amber: 'bg-[#fdf3e2] text-[#b06a06]', red: 'bg-[#fdecef] text-[#c8384f]' };

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

// A tiny inline sparkline (ApexCharts, no axes/tooltip) for the KPI tiles.
function MiniSpark({ data, color }: { data: number[]; color: string }) {
  const opts: any = {
    chart: { type: 'area', sparkline: { enabled: true }, animations: { enabled: false } },
    stroke: { width: 1.6, curve: 'smooth' }, fill: { type: 'solid', opacity: 0.14 },
    colors: [color], tooltip: { enabled: false },
  };
  return <ReactApexChart options={opts} series={[{ data }]} type="area" height={30} width={64} />;
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
  const rangeLabel = range === 'Today' ? 'today' : range === 'This week' ? 'this week' : range === 'This month' ? 'this month' : 'this term';
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
  const urgentCount = attention.filter((a) => a.severity === 'high').length;

  const funnel = useMemo(() => {
    const L = leads.length, C = leads.filter((l) => l.stage !== 'new').length, D = leads.filter((l) => l.stage === 'demo' || l.stage === 'won').length, W = leads.filter((l) => l.stage === 'won').length;
    return { L, C, D, W, convPct: L ? Math.round((W / L) * 100) : 0 };
  }, [leads]);

  // 7-day leads-per-day sparkline (from the loaded lead window).
  const leadsByDay = useMemo(() => {
    const arr = new Array(7).fill(0);
    for (const l of data.leads) if (l.createdDaysAgo <= 6) arr[6 - l.createdDaysAgo] += 1;
    return arr;
  }, [data.leads]);

  // Reactive KPI values: leads/classes/needs-action come from the filtered window.
  const cActive = useCountUp(data.kpis.activeStudents, mounted);
  const cLeads = useCountUp(leads.length, mounted);
  const cClasses = useCountUp(dayClasses.length, mounted);
  const cAction = useCountUp(attention.length, mounted);
  const cOverdue = useCountUp(Math.round(data.fees.overdue / 1000), mounted);

  // ---- Chart option/series (memoised; recompute when filters/data change) ----
  const fMonth = data.forecast.monthLabel ? `${data.forecast.monthLabel.slice(0, 3)}*` : null;
  const revLabels = [...data.revenueHistory.map((r) => r.label), ...(fMonth ? [fMonth] : [])];
  const revBilled = [...data.revenueHistory.map((r) => Math.round(r.billed / 1000)), ...(fMonth ? [Math.round(data.forecast.recurringNextMonth / 1000)] : [])];
  const revCollected = [...data.revenueHistory.map((r) => Math.round(r.collected / 1000)), ...(fMonth ? [null as any] : [])];
  const revOpts: any = {
    chart: { type: 'line', toolbar: { show: false }, fontFamily: 'inherit', foreColor: C.muted, animations: { enabled: true, speed: 500 } },
    colors: [C.purple, C.green], stroke: { width: [0, 3], curve: 'smooth' },
    plotOptions: { bar: { columnWidth: '48%', borderRadius: 5 } }, fill: { opacity: [0.9, 1] },
    markers: { size: [0, 4], hover: { size: 6 } }, dataLabels: { enabled: false },
    grid: { borderColor: C.grid, strokeDashArray: 3 },
    xaxis: { categories: revLabels, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v: number) => `Rs ${Math.round(v)}k` } },
    legend: { show: true, position: 'top', horizontalAlign: 'right', fontSize: '12px', markers: { radius: 6 } },
    tooltip: { theme: 'light', y: { formatter: (v: number) => (v == null ? 'forecast' : `Rs ${Math.round(v)}k`) } },
  };
  const revSeries = [{ name: 'Billed', type: 'column', data: revBilled }, { name: 'Collected', type: 'line', data: revCollected }];

  const enrollOpts: any = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit', foreColor: C.muted, animations: { enabled: true, speed: 500 } },
    colors: [C.green], stroke: { width: 2.5, curve: 'smooth' }, fill: { type: 'solid', opacity: 0.13 },
    dataLabels: { enabled: false }, grid: { borderColor: C.grid, strokeDashArray: 3 },
    xaxis: { categories: data.enrollHistory.map((e) => e.label), axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
    tooltip: { theme: 'light' }, markers: { size: 0, hover: { size: 5 } },
  };
  const enrollSeries = [{ name: 'New students', data: data.enrollHistory.map((e) => e.count) }];

  const funnelSteps = [
    { label: 'Leads', n: funnel.L }, { label: 'Contacted', n: funnel.C },
    { label: 'Demos', n: funnel.D }, { label: 'Won', n: funnel.W },
  ];
  const convPct = (a: number, b: number) => (a > 0 ? Math.round((b / a) * 100) : 0);
  const funnelHops = [
    { to: 'contacted', pct: convPct(funnel.L, funnel.C) },
    { to: 'demo', pct: convPct(funnel.C, funnel.D) },
    { to: 'won', pct: convPct(funnel.D, funnel.W) },
  ];
  const funnelOpts: any = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', foreColor: C.muted, animations: { enabled: true, speed: 500 }, dropShadow: { enabled: false } },
    colors: [C.purple, C.purpleSoft, C.blue, C.green],
    plotOptions: { bar: { horizontal: true, distributed: true, barHeight: '74%', borderRadius: 4, isFunnel: true } },
    dataLabels: { enabled: true, formatter: (val: number, opt: any) => `${opt.w.globals.labels[opt.dataPointIndex]}  ${val}`, style: { colors: ['#fff'], fontWeight: 500, fontSize: '12.5px' }, dropShadow: { enabled: false } },
    grid: { show: false }, xaxis: { categories: funnelSteps.map((s) => s.label) },
    yaxis: { labels: { show: false } }, legend: { show: false },
    tooltip: { enabled: true, theme: 'light', y: { formatter: (v: number) => `${v} lead${v === 1 ? '' : 's'}` } },
  };
  const funnelSeries = [{ name: 'Count', data: funnelSteps.map((s) => s.n) }];

  // Teacher load: capacity utilisation, busiest first (already sorted in the data layer).
  const teacherAvg = teachers.length ? Math.round(teachers.reduce((s, t) => s + (t.capacity ? Math.min(100, (t.load / t.capacity) * 100) : 0), 0) / teachers.length) : 0;
  const teacherOverloaded = teachers.filter((t) => t.capacity && t.load / t.capacity >= 0.9).length;

  const reset = () => { setRange('This week'); setProgram('All programs'); setTeacher('All teachers'); setSubject('All subjects'); setSource('All sources'); setSelDate(data.todayISO); };
  const exportCsv = () => {
    const rows = [['Date', 'Time', 'Subject', 'Student', 'Teacher', 'Status'], ...dayClasses.map((c) => [c.dateISO, c.time, c.subject, c.student, c.teacher, c.status])];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `classes-${selDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const chip = 'inline-flex items-center gap-1.5 rounded-[9px] border border-[#e0e3ee] bg-white px-3 py-2 text-[13px] font-medium text-[#6b7391] cursor-pointer hover:border-[#c9cee0]';

  // KPI tiles: reactive ones are marked (leads / classes / needs-action).
  const kpis: any[] = [
    { l: 'Active students', v: cActive, sub: 'enrolled', icon: <Users className="h-[18px] w-[18px]" />, ic: 'bg-[#e6f7ee] text-[#11a256]', to: '/students', spark: data.enrollHistory.map((e) => e.count), sparkC: C.green },
    { l: 'New leads', v: cLeads, sub: rangeLabel, icon: <Target className="h-[18px] w-[18px]" />, ic: 'bg-[#eaf1ff] text-[#2f6df6]', to: '/leads', spark: leadsByDay, sparkC: C.blue },
    { l: 'Classes', v: cClasses, sub: selDate === data.todayISO ? 'today' : fmtDay(selDate), icon: <Calendar className="h-[18px] w-[18px]" />, ic: 'bg-[#efedfe] text-[#5b47d6]', to: '/schedule' },
    { l: 'Needs action', v: cAction, sub: urgentCount > 0 ? `${urgentCount} urgent` : attention.length > 0 ? 'none urgent' : 'all clear', hot: urgentCount > 0, icon: <Zap className="h-[18px] w-[18px]" />, ic: 'bg-[#fdf3e2] text-[#d9820a]' },
  ];
  if (!isManager) {
    kpis.push(
      { l: 'Overdue fees', v: `Rs ${cOverdue}k`, sub: 'grace expired', hot: data.fees.overdue > 0, icon: <AlertTriangle className="h-[18px] w-[18px]" />, ic: 'bg-[#fdecef] text-[#e0435a]', to: '/vouchers' },
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-dmsans, var(--font-inter), system-ui)' }} className="space-y-4 text-[15px] text-[#0f1729]">
      {(data.kpis.demosToAssign > 0 || data.fees.overdue > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="relative flex flex-wrap items-center gap-3.5 overflow-hidden rounded-2xl border border-[#f4cdd4] bg-white px-4 py-3.5">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#e0435a]" />
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-[#fdecef] text-[#e0435a]"><AlertTriangle className="h-5 w-5" /></span>
          <div className="text-[14px]"><b className="font-medium">{data.kpis.demosToAssign} demos need a teacher</b> <span className="text-[#6b7391]">· {data.attention.some((a) => a.kind === 'overdue') ? 'fees overdue' : 'all fees on track'}</span></div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => router.push('/demos?new=1')} className="rounded-[9px] bg-[#e0435a] px-4 py-2 text-[13px] font-medium text-white">Assign demos</button>
            {!isManager && <button onClick={() => router.push('/vouchers')} className="rounded-[9px] border border-[#e0e3ee] bg-white px-4 py-2 text-[13px] font-medium text-[#3b4258]">Review fees</button>}
          </div>
        </motion.div>
      )}

      <HealthStrip health={data.health} />

      {/* filter bar */}
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-[#eaecf3] bg-white/95 p-2.5 backdrop-blur">
        <Seg value={range} onChange={setRange} opts={[{ k: 'Today', label: 'Today' }, { k: 'This week', label: 'Week' }, { k: 'This month', label: 'Month' }, { k: 'This term', label: 'Term' }]} />
        <Sel label="programs" value={program} onChange={setProgram} opts={data.options.programs} />
        <Sel label="teachers" value={teacher} onChange={setTeacher} opts={data.options.teachers} />
        <Sel label="subjects" value={subject} onChange={setSubject} opts={data.options.subjects} />
        <Sel label="sources" value={source} onChange={setSource} opts={data.options.sources} />
        <div className="flex-1" />
        <button onClick={reset} className={chip}><RefreshCw className="h-4 w-4" />Reset</button>
        <button onClick={exportCsv} className={chip}><Download className="h-4 w-4" />Export</button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => (
          <Card key={k.l} i={i} className={cls(k.to && 'cursor-pointer', k.hot && '!border-[#f3cdd4]')}>
            <motion.div whileHover={k.to ? { y: -3 } : undefined} transition={{ duration: 0.2 }} onClick={() => k.to && router.push(k.to)}>
              <div className="mb-2 flex items-center justify-between">
                <span className={cls('flex h-9 w-9 items-center justify-center rounded-[10px]', k.ic)}>{k.icon}</span>
                {k.spark && <div className="h-[30px]">{mounted && <MiniSpark data={k.spark} color={k.sparkC} />}</div>}
              </div>
              <div className="text-[12.5px] font-medium text-[#6b7391]">{k.l}</div>
              <div className={cls('mt-0.5 text-[24px] font-medium tracking-tight tabular-nums', k.hot && 'text-[#e0435a]')}>{k.v}</div>
              {k.bullet != null ? (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f6]"><motion.i initial={{ width: 0 }} animate={{ width: `${k.bullet}%` }} transition={{ duration: 0.8 }} className="block h-full rounded-full" style={{ background: k.bulletC }} /></div>
                  <div className="mt-1 text-[11px] text-[#8a86a3]">{k.sub}</div>
                </div>
              ) : <div className={cls('mt-0.5 text-[11.5px]', k.hot ? 'text-[#e0435a]' : 'text-[#8a86a3]')}>{k.sub}</div>}
            </motion.div>
          </Card>
        ))}
      </div>

      {/* hero: classes (day navigator) + action center - most important, on top */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card i={1} className="lg:col-span-7">
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

        {/* Action center: everything across the system that needs a decision */}
        <Card i={2} className="lg:col-span-5">
          <SecH title={<><Zap className="h-5 w-5 text-[#d9820a]" />Action center</>} right={<div className="flex items-center gap-2"><Seg value={attnUrgent} onChange={setAttnUrgent} opts={[{ k: 'all', label: 'All' }, { k: 'urgent', label: 'Urgent' }]} />{attention.length > 0 && <span className="rounded-full bg-[#fdecef] px-2 py-0.5 text-[12px] font-medium text-[#e0435a]">{attention.length}</span>}</div>} />
          {attention.length === 0 && <div className="py-8 text-center text-[13px] text-[#98a0bd]">Nothing needs action right now. All clear.</div>}
          {attention.map((a) => {
            const ic = a.kind === 'demo' ? 'bg-[#fdf3e2] text-[#d9820a]' : a.kind === 'overdue' || a.kind === 'atrisk' ? 'bg-[#fdecef] text-[#e0435a]' : 'bg-[#efedfe] text-[#5b47d6]';
            const Icon = a.kind === 'demo' ? UserPlus : a.kind === 'atrisk' ? Heart : a.kind === 'unmarked' ? ClipboardCheck : AlertTriangle;
            return (
              <div key={a.id} className={cls('mb-2 flex items-center gap-2.5 rounded-xl border p-2.5', a.severity === 'high' ? 'border-[#f3cdd4] bg-[#fef8f9]' : 'border-[#eaecf3]')}>
                <span className={cls('flex h-8 w-8 flex-none items-center justify-center rounded-[9px]', ic)}><Icon className="h-[18px] w-[18px]" /></span>
                <div className="flex-1 min-w-0"><div className="text-[14px] font-medium truncate">{a.title}</div><div className="text-[12.5px] text-[#6b7391] truncate">{a.sub}</div></div>
                <button onClick={() => router.push(a.href)} className="ml-auto flex-none rounded-lg bg-[#f6f4ff] px-3 py-1.5 text-[12.5px] font-medium text-[#5b47d6]">{a.action}</button>
              </div>
            );
          })}
        </Card>
      </div>

      {/* teachers + lead funnel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card i={3} className="lg:col-span-6">
          <SecH title={<><Users className="h-5 w-5 text-[#2f6df6]" />Teacher load</>} right={<Seg value={availOnly} onChange={setAvailOnly} opts={[{ k: 'all', label: 'All' }, { k: 'available', label: 'Free' }]} />} />
          {teachers.length === 0 ? <div className="py-10 text-center text-[13px] text-[#98a0bd]">No teachers to show.</div>
            : <>
              <div className="mb-3 flex items-center gap-4 rounded-xl bg-[#f8f9fc] px-3 py-2 text-[12.5px]">
                <span className="text-[#6b7391]">Avg load <b className="text-[#0f1729]">{teacherAvg}%</b></span>
                <span className="text-[#6b7391]">{teachers.length} teacher{teachers.length > 1 ? 's' : ''}</span>
                {teacherOverloaded > 0 && <span className="ml-auto rounded-full bg-[#fdecef] px-2 py-0.5 font-medium text-[#e0435a]">{teacherOverloaded} at capacity</span>}
              </div>
              <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {teachers.map((t) => {
                  const pct = t.capacity ? Math.min(100, Math.round((t.load / t.capacity) * 100)) : 0;
                  const free = Math.max(0, t.capacity - t.load);
                  const bar = pct >= 90 ? '#e0435a' : pct >= 75 ? '#d9820a' : '#11a256';
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[#eef0f6] p-2.5">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#efedfe] text-[11px] font-medium text-[#5b47d6]">{t.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-medium">{t.name}</span>
                          <span className="flex-none text-[12px] tabular-nums text-[#6b7391]">{t.load}/{t.capacity} · {pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#eef0f6]">
                          <motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} className="block h-full rounded-full" style={{ background: bar }} />
                        </div>
                      </div>
                      <span className={cls('flex-none rounded-full px-2 py-0.5 text-[11.5px] font-medium', free === 0 ? 'bg-[#fdecef] text-[#e0435a]' : 'bg-[#e6f7ee] text-[#0f8a44]')}>{free === 0 ? 'Full' : `${free} free`}</span>
                    </div>
                  );
                })}
              </div>
            </>}
        </Card>

        <Card i={4} className="lg:col-span-6">
          <SecH title={<><Target className="h-5 w-5 text-[#5b47d6]" />Lead funnel</>} right={<span className="text-[13px] font-medium text-[#11a256]">{funnel.convPct}% convert</span>} />
          {funnel.L === 0 ? <div className="py-10 text-center text-[13px] text-[#98a0bd]">No leads for these filters.</div>
            : <>
              <div className="min-h-[188px]">{mounted && <ReactApexChart options={funnelOpts} series={funnelSeries} type="bar" height={188} />}</div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                {funnelHops.map((h) => (
                  <div key={h.to} className="rounded-lg bg-[#f8f9fc] py-1.5">
                    <div className="text-[13px] font-medium text-[#0f1729]">{h.pct}%</div>
                    <div className="text-[11px] text-[#8a86a3]">to {h.to}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-center text-[12px] text-[#6b7391]">{leads.length} leads {rangeLabel} · {funnel.convPct}% overall</div>
            </>}
        </Card>
      </div>

      {/* finance and analytics - kept at the end */}
      {!isManager && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card i={5} className="lg:col-span-8">
              <SecH title={<><TrendingUp className="h-5 w-5 text-[#5b47d6]" />Revenue and collections</>} right={<span className="text-[13px] text-[#6b7391]">{fMonth ? `${fMonth.replace('*', '')} is forecast` : 'last 6 months'}</span>} />
              <div className="min-h-[262px]">{mounted && <ReactApexChart options={revOpts} series={revSeries} type="line" height={262} />}</div>
            </Card>
            <Card i={6} className="lg:col-span-4">
              <SecH title={<><Users className="h-5 w-5 text-[#11a256]" />New enrollments</>} right={<span className="text-[13px] text-[#6b7391]">6 mo</span>} />
              <div className="min-h-[262px]">{mounted && <ReactApexChart options={enrollOpts} series={enrollSeries} type="area" height={262} />}</div>
            </Card>
          </div>

          <Card i={7}>
            <SecH title={<><Wallet className="h-5 w-5 text-[#11a256]" />Fees</>} right={<span className="text-[13px] text-[#6b7391]">This month</span>} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-[#f8f9fc] p-3"><div className="text-[12px] text-[#6b7391]">Overdue</div><div className="mt-0.5 text-[20px] font-medium text-[#e0435a]">{rsK(data.fees.overdue)}</div><div className="mt-0.5 text-[11px] text-[#8a86a3]">grace expired</div></div>
              <div className="rounded-xl bg-[#f8f9fc] p-3"><div className="text-[12px] text-[#6b7391]">Outstanding</div><div className="mt-0.5 text-[20px] font-medium text-[#d9820a]">{rsK(data.fees.outstanding)}</div><div className="mt-0.5 text-[11px] text-[#8a86a3]">unpaid vouchers</div></div>
              <div className="rounded-xl bg-[#f8f9fc] p-3">
                <div className="text-[12px] text-[#6b7391]">Collection</div>
                <div className="mt-0.5 flex items-center gap-2"><b className="text-[20px] font-medium tabular-nums text-[#11a256]">{data.fees.collectionPct}%</b>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0f6]"><motion.i initial={{ width: 0 }} animate={{ width: `${data.fees.collectionPct}%` }} transition={{ duration: 0.8 }} className="block h-full rounded-full bg-[#11a256]" /></div>
                </div>
                <div className="mt-1 text-[11px] text-[#8a86a3]">of billed collected</div>
              </div>
              <div className="rounded-xl border border-[#e7e2fb] bg-[#f6f4ff] p-3">
                <div className="flex items-center justify-between"><span className="text-[12px] text-[#6b7391]">Recurring next month</span><span className="text-[11px] text-[#8a86a3]">{data.forecast.activeMonthly} monthly</span></div>
                <div className="mt-0.5 text-[20px] font-medium text-[#5b47d6]">{rsK(data.forecast.recurringNextMonth)}</div>
                {data.forecast.endingCount > 0
                  ? <div className="mt-0.5 text-[11px] text-[#d9820a]">{data.forecast.endingCount} plan{data.forecast.endingCount > 1 ? 's' : ''} end next month (-{rsK(data.forecast.endingNextMonth)})</div>
                  : <div className="mt-0.5 text-[11px] text-[#8a86a3]">billed, upfront excluded</div>}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
