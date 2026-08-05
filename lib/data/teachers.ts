// Teachers data-access (RLS-enforced, server-only). Pattern: see lib/data/students.ts.
// Pay lives in the separate Admin-only `teacher_pay_rates` table. We nested-select
// it here, but RLS filters the embedded rows per role: an Admin sees the rate, a
// Manager/Teacher/Student gets an EMPTY array (so perClassPay resolves to 0). The
// isolation is enforced at the DB, not by hiding the column in code.
import { createClient } from '@/lib/supabase/server';
import type { Teacher } from '@/app/teachers/TeachersClient';

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  capacity: number;
  status: 'available' | 'in_class' | 'on_leave';
  rating: number;
  demos_given: number;
  demos_converted: number;
  reliability: number;
  join_date: string;
  city: string | null;
}

// TeacherScore = 0.45·Rating% + 0.35·DemoConversion% + 0.20·Reliability%.
// Cold start: < 5 completed demos => null ("Building record" / "New").
function teacherScore(r: TeacherRow): number | null {
  if (r.demos_given < 5) return null;
  const ratingPct = (r.rating / 5) * 100;
  const convPct = r.demos_given > 0 ? (r.demos_converted / r.demos_given) * 100 : 0;
  const relPct = r.reliability;
  return Math.round(0.45 * ratingPct + 0.35 * convPct + 0.2 * relPct);
}

function mapRow(r: any): Teacher {
  const status: Teacher['status'] = r.status === 'on_leave' ? 'On Leave' : 'Teaching';
  // RLS returns pay rates only to an Admin; for everyone else this is empty -> 0.
  const rates: any[] = Array.isArray(r.teacher_pay_rates) ? r.teacher_pay_rates : [];
  const latestRate = rates
    .slice()
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)))[0];
  return {
    id: r.id,
    empId: `TCH-${r.id.split('-')[0].toUpperCase()}`,
    name: r.name,
    email: r.email,
    phone: r.phone,
    joinDate: r.join_date,
    subjects: [],       // from teacher_subjects (later slice)
    programs: [],
    capacity: r.capacity,
    currentLoad: 0,     // from class_sessions (Phase 4)
    perClassPay: latestRate ? Number(latestRate.rate_per_class) : 0,
    score: teacherScore(r),
    rating: r.rating,
    ratingCount: 0,
    status,
    experience: '',
    qualification: '',
    todaysClassesCount: 0,
    pendingReviewsCount: 0,
    payrollStatus: 'Ready',
    alertsCount: 0,
    schedule: [],
  };
}

export async function getTeachers(): Promise<Teacher[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teachers')
    .select('id,name,email,phone,capacity,status,rating,demos_given,demos_converted,reliability,join_date,city,teacher_pay_rates(rate_per_class,effective_from)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
