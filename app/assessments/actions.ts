'use server';

// Tests write action. A test is a raw academic record (student, subject, score).
// Per the plan the teacher also sets the CAIE assessed_grade on student_subjects
// after a test — that requires the subject enrolment and is a follow-up; here we
// record the test itself. RLS decides permission.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function recordTest(input: {
  studentId: string;
  subjectId: string;
  name: string;
  date: string; // YYYY-MM-DD
  score: number;
  maxScore: number;
}): Promise<ActionResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Test name is required.' };
  if (!input.studentId) return { ok: false, error: 'Select a student.' };
  if (!input.subjectId) return { ok: false, error: 'Select a subject.' };
  if (!input.date) return { ok: false, error: 'Select a date.' };

  const score = Number(input.score);
  const maxScore = Number(input.maxScore) || 100;
  if (Number.isNaN(score) || score < 0) return { ok: false, error: 'Enter a valid score.' };
  if (score > maxScore) return { ok: false, error: 'Score cannot exceed the maximum marks.' };

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

  const { error } = await supabase.from('tests').insert({
    org_id: profile.org_id,
    student_id: input.studentId,
    subject_id: input.subjectId,
    name,
    date: input.date,
    score,
    max_score: maxScore,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/assessments');
  revalidatePath('/');
  return { ok: true };
}
