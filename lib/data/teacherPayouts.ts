// Teacher payouts data-access — RLS-enforced, server-only. Admin-only
// (teacher_pay_rates is the isolated pay table; Managers are DENIED at the DB).
import { createClient } from '@/lib/supabase/server';
import type { TeacherPayout } from '@/app/teacher-payouts/TeacherPayoutsClient';

function one<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? rel[0] ?? null : rel ?? null;
}

function mapRow(r: any): TeacherPayout {
  const teacher = one<any>(r.teachers);
  return {
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: teacher?.name ?? '',
    subjects: [],
    perClassPay: Number(r.rate_per_class || 0),
    completedClassesCount: 0, // from class_sessions (Phase 4)
    grossAmount: 0,
    status: 'Pending',
    paymentMethod: '',
    bankAccount: '',
  };
}

export async function getTeacherPayouts(): Promise<TeacherPayout[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teacher_pay_rates')
    .select('id,teacher_id,rate_per_class,currency,effective_from,teachers(name)')
    .is('deleted_at', null)
    .order('effective_from', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
