// Admin dashboard data - REAL, RLS-scoped (runs under the admin session). Returns
// a class window (so the date navigator + makeup detection work client-side),
// leads, teacher load, attention items, fees, and filter options from live data.
import { createClient } from '@/lib/supabase/server';

export interface AdminClass {
  id: string;
  dateISO: string;      // PKT calendar date YYYY-MM-DD
  time: string;         // PKT HH:MM
  startISO: string;
  endISO: string;
  subject: string;
  program: string;
  teacher: string;
  student: string;
  studentId: string;
  subjectId: string;
  status: 'completed' | 'live' | 'upcoming' | 'missed' | 'cancelled';
  type: string;         // class | makeup | test
  meetingLink: string;
}
export interface AdminLead {
  id: string; name: string; source: string; program: string;
  stage: 'new' | 'contacted' | 'demo' | 'won' | 'lost'; createdDaysAgo: number;
}
export interface AdminTeacherLoad { id: string; name: string; load: number; capacity: number; subjects: string[] }
export interface AdminAttention {
  id: string; kind: 'demo' | 'overdue' | 'atrisk' | 'unmarked';
  title: string; sub: string; severity: 'high' | 'medium'; action: string;
  program?: string; teacher?: string; href: string;
}
export interface SystemHealth {
  // Notification queue / email delivery
  queued: number;
  failed: number;
  sent24h: number;
  oldestQueuedMins: number | null; // age of the oldest un-sent item
  cronStuck: boolean;              // queue backlog is old -> cron likely not running
  lastSendISO: string | null;      // last time the sender delivered anything
  emailConfigured: boolean;
  // Google Calendar
  calendarConfigured: boolean;
  classesMissingLink: number;      // upcoming scheduled classes with no Meet link
  demosMissingLink: number;        // assigned demos with no Meet link
}
export interface AdminData {
  demo: boolean;
  todayISO: string;
  classes: AdminClass[];
  leads: AdminLead[];
  teachers: AdminTeacherLoad[];
  attention: AdminAttention[];
  fees: { overdue: number; outstanding: number; collectionPct: number };
  kpis: { classesToday: number; demosToAssign: number; newLeadsToday: number; atRisk: number; overdueAmount: number; activeStudents: number };
  options: { programs: string[]; teachers: string[]; subjects: string[]; sources: string[] };
  health: SystemHealth;
}

const PROGRAMS = ['O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE', 'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)'];
const SOURCE_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp', referral: 'Referral', walk_in: 'Walk-in' };
const SOURCES = Object.values(SOURCE_LABEL);
const STAGE: Record<string, AdminLead['stage']> = { new: 'new', contacted: 'contacted', demo_booked: 'demo', won: 'won', lost: 'lost' };

function one<T>(r: T | T[] | null | undefined): T | null { return Array.isArray(r) ? r[0] ?? null : r ?? null; }
const pktDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const pktTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: false });

function statusOf(startISO: string, endISO: string, db: string): AdminClass['status'] {
  if (db === 'completed') return 'completed';
  if (db === 'cancelled') return 'cancelled';
  const now = Date.now(), s = new Date(startISO).getTime(), e = new Date(endISO).getTime();
  if (now < s) return 'upcoming';
  if (now <= e) return 'live';
  return 'missed';
}

const EMPTY_HEALTH: SystemHealth = {
  queued: 0, failed: 0, sent24h: 0, oldestQueuedMins: null, cronStuck: false, lastSendISO: null,
  emailConfigured: false, calendarConfigured: false, classesMissingLink: 0, demosMissingLink: 0,
};

export const EMPTY_ADMIN_DATA: AdminData = {
  demo: false, todayISO: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }),
  classes: [], leads: [], teachers: [], attention: [], fees: { overdue: 0, outstanding: 0, collectionPct: 0 },
  kpis: { classesToday: 0, demosToAssign: 0, newLeadsToday: 0, atRisk: 0, overdueAmount: 0, activeStudents: 0 },
  options: { programs: PROGRAMS, teachers: [], subjects: [], sources: SOURCES },
  health: EMPTY_HEALTH,
};

export async function getAdminDashboard(): Promise<AdminData> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return EMPTY_ADMIN_DATA;

  const now = new Date();
  const todayISO = pktDate(now.toISOString());
  const winStart = new Date(now.getTime() - 21 * 864e5).toISOString();
  const winEnd = new Date(now.getTime() + 21 * 864e5).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const [clsRes, leadsRes, teachersRes, subjRes, ssRes, demosRes, vouchersRes, paymentsRes, studentsRes,
    notifsRes, sent24hRes, lastSendRes, clsMissingRes, demoMissingRes] = await Promise.all([
    supabase.from('class_sessions')
      .select('id,start_at,end_at,status,type,meeting_link,student_id,subject_id,students(name,program),subjects(name),teachers(name)')
      .gte('start_at', winStart).lte('start_at', winEnd).is('deleted_at', null).order('start_at', { ascending: true }),
    supabase.from('leads').select('id,name,source,program,status,created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
    supabase.from('teachers').select('id,name,capacity').is('deleted_at', null),
    supabase.from('subjects').select('name').is('deleted_at', null),
    supabase.from('student_subjects').select('teacher_id').is('deleted_at', null),
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('status', 'needs_teacher').is('deleted_at', null),
    supabase.from('vouchers').select('id,amount,status,grace_deadline,students(name)').neq('status', 'paid').is('deleted_at', null),
    supabase.from('payments').select('amount').gte('created_at', monthStart).is('deleted_at', null),
    supabase.from('students').select('id,name,fee_status').eq('status', 'active').is('deleted_at', null),
    // --- System health ---
    supabase.from('notifications').select('status,created_at').in('status', ['queued', 'failed']).is('deleted_at', null),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('updated_at', dayAgo).is('deleted_at', null),
    supabase.from('notifications').select('updated_at').eq('status', 'sent').is('deleted_at', null).order('updated_at', { ascending: false }).limit(1),
    supabase.from('class_sessions').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gte('start_at', now.toISOString()).is('meeting_link', null).is('deleted_at', null),
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').not('teacher_id', 'is', null).is('meeting_link', null).is('deleted_at', null),
  ]);

  // classes
  const classes: AdminClass[] = (clsRes.data as any[] ?? []).map((r) => {
    const st = one<any>(r.students), sub = one<any>(r.subjects), te = one<any>(r.teachers);
    return {
      id: r.id, dateISO: pktDate(r.start_at), time: pktTime(r.start_at), startISO: r.start_at, endISO: r.end_at,
      subject: sub?.name ?? 'Class', program: st?.program ?? '', teacher: te?.name ?? 'Unassigned',
      student: st?.name ?? '', studentId: r.student_id ?? '', subjectId: r.subject_id ?? '',
      status: statusOf(r.start_at, r.end_at, r.status), type: r.type ?? 'class', meetingLink: r.meeting_link ?? '',
    };
  });

  // leads
  const leads: AdminLead[] = (leadsRes.data as any[] ?? []).map((l) => ({
    id: l.id, name: l.name ?? '', source: SOURCE_LABEL[l.source] ?? 'Google', program: l.program ?? '',
    stage: STAGE[l.status] ?? 'new', createdDaysAgo: Math.max(0, Math.floor((now.getTime() - new Date(l.created_at).getTime()) / 864e5)),
  }));

  // teacher load = enrolled student_subjects rows per teacher
  const loadBy = new Map<string, number>();
  for (const r of (ssRes.data as any[] ?? [])) { const t = (r as any).teacher_id; if (t) loadBy.set(t, (loadBy.get(t) ?? 0) + 1); }
  const teachers: AdminTeacherLoad[] = (teachersRes.data as any[] ?? []).map((t) => ({
    id: t.id, name: t.name, capacity: t.capacity ?? 20, load: loadBy.get(t.id) ?? 0, subjects: [],
  })).sort((a, b) => b.load / (b.capacity || 1) - a.load / (a.capacity || 1));

  // fees
  const vouchers = (vouchersRes.data as any[] ?? []);
  const overdueVouchers = vouchers.filter((v) => v.grace_deadline && pktDate(new Date(v.grace_deadline).toISOString?.() ?? v.grace_deadline) < todayISO);
  const overdueAmount = overdueVouchers.reduce((s, v) => s + Number(v.amount ?? 0), 0);
  const outstanding = vouchers.reduce((s, v) => s + Number(v.amount ?? 0), 0);
  const collected = (paymentsRes.data as any[] ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const collectionPct = collected + outstanding > 0 ? Math.round((collected / (collected + outstanding)) * 100) : 0;

  // at-risk = active students whose fee is stopped or in grace
  const atRiskStudents = (studentsRes.data as any[] ?? []).filter((s) => s.fee_status === 'stopped' || s.fee_status === 'in_grace');

  // unmarked = past-window classes still not completed/cancelled
  const unmarked = classes.filter((c) => c.status === 'missed').length;
  const demosToAssign = demosRes.count ?? 0;

  const attention: AdminAttention[] = [];
  if (demosToAssign > 0) attention.push({ id: 'at-demo', kind: 'demo', title: `${demosToAssign} demos need a teacher`, sub: 'assign a teacher to send the invite', severity: 'high', action: 'Assign', href: '/demos?new=1' });
  if (overdueVouchers.length > 0) attention.push({ id: 'at-overdue', kind: 'overdue', title: `${overdueVouchers.length} vouchers overdue`, sub: `Rs ${Math.round(overdueAmount / 1000)}k, grace expired`, severity: 'high', action: 'Review', href: '/vouchers' });
  for (const s of atRiskStudents.slice(0, 3)) attention.push({ id: `at-risk-${s.id}`, kind: 'atrisk', title: `${s.name}`, sub: s.fee_status === 'stopped' ? 'fee stopped' : 'in grace period', severity: 'medium', action: 'Open', href: '/students' });
  if (unmarked > 0) attention.push({ id: 'at-unmarked', kind: 'unmarked', title: `${unmarked} classes unmarked`, sub: 'attendance not recorded', severity: 'medium', action: 'Open', href: '/schedule' });

  const subjects = Array.from(new Set((subjRes.data as any[] ?? []).map((s) => s.name).filter(Boolean))).sort();

  // --- System health (silent-failure monitoring) ---
  const backlog = (notifsRes.data as any[] ?? []);
  const queued = backlog.filter((n) => n.status === 'queued').length;
  const failed = backlog.filter((n) => n.status === 'failed').length;
  const queuedTimes = backlog.filter((n) => n.status === 'queued').map((n) => new Date(n.created_at).getTime()).filter((t) => !Number.isNaN(t));
  const oldestQueuedMins = queuedTimes.length ? Math.floor((now.getTime() - Math.min(...queuedTimes)) / 60000) : null;
  // The cron should drain the queue every 10-15 min; a queued item older than 25
  // min means the cron is very likely NOT running.
  const cronStuck = oldestQueuedMins != null && oldestQueuedMins > 25;
  const lastSendISO = ((lastSendRes.data as any[] ?? [])[0]?.updated_at as string) ?? null;
  const rt = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && rt && !rt.startsWith('PASTE_'));
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const health: SystemHealth = {
    queued, failed, sent24h: sent24hRes.count ?? 0, oldestQueuedMins, cronStuck, lastSendISO,
    emailConfigured, calendarConfigured,
    classesMissingLink: clsMissingRes.count ?? 0,
    demosMissingLink: demoMissingRes.count ?? 0,
  };

  return {
    demo: false, todayISO, classes, leads, teachers, attention, health,
    fees: { overdue: overdueAmount, outstanding, collectionPct },
    kpis: {
      classesToday: classes.filter((c) => c.dateISO === todayISO).length,
      demosToAssign,
      newLeadsToday: leads.filter((l) => l.createdDaysAgo === 0).length,
      atRisk: atRiskStudents.length,
      overdueAmount,
      activeStudents: (studentsRes.data as any[] ?? []).length,
    },
    options: { programs: PROGRAMS, teachers: teachers.map((t) => t.name), subjects, sources: SOURCES },
  };
}
