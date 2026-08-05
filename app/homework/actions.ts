'use server';

// Homework write action. One homework row per (student, subject). RLS decides
// permission. Feeds the 30% homework-completion health metric.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createHomework(input: {
  studentId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  deadline: string; // YYYY-MM-DD (PKT)
}): Promise<ActionResult> {
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Homework title is required.' };
  if (!input.studentId) return { ok: false, error: 'Select a student.' };
  if (!input.subjectId) return { ok: false, error: 'Select a subject.' };
  if (!input.teacherId) return { ok: false, error: 'Select a teacher.' };
  if (!input.deadline) return { ok: false, error: 'Select a deadline.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };

  // Deadline = end of that day, PKT, stored UTC.
  const deadlineIso = new Date(`${input.deadline}T23:59:00+05:00`).toISOString();

  const { error } = await supabase.from('homework').insert({
    org_id: profile.org_id,
    student_id: input.studentId,
    subject_id: input.subjectId,
    teacher_id: input.teacherId,
    title,
    deadline: deadlineIso,
    status: 'assigned',
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}

/** Mark a homework graded (counts as on-time completion in the health formula). */
export async function gradeHomework(input: {
  homeworkId: string;
  score?: number;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const patch: Record<string, any> = { status: 'graded' };
  if (input.score != null && !Number.isNaN(input.score)) patch.score = input.score;

  const { error } = await supabase.from('homework').update(patch).eq('id', input.homeworkId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}
