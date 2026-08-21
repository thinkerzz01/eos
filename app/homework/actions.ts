'use server';

// Homework write action. One homework row per (student, subject). RLS decides
// permission. Feeds the 30% homework-completion health metric.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { notifyStudentById } from '@/lib/notifications/inapp';

export interface ActionResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

// Staff-only gate for the create/grade/edit/delete actions. Homework grading and
// authoring is admin/manager/teacher only - never a student (who otherwise could
// call gradeHomework on their own row). RLS is the real boundary; this is an
// explicit, friendly-error defense-in-depth check. Returns null when allowed.
async function requireStaff(
  supabase: ReturnType<typeof createClient>
): Promise<{ error: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You are not signed in.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile || !['admin', 'manager', 'teacher'].includes(profile.role)) {
    return { error: 'You do not have permission to do that.' };
  }
  return null;
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
  const gate = await requireStaff(supabase);
  if (gate) return { ok: false, error: gate.error };
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

  // Let the student know (in-app bell) - best-effort.
  await notifyStudentById(profile.org_id, input.studentId, {
    title: 'New homework assigned',
    body: title,
    link: '/homework',
  });

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}

/** Edit a homework's title and/or deadline. RLS enforces write permission. */
export async function updateHomework(input: {
  homeworkId: string;
  title?: string;
  deadline?: string; // YYYY-MM-DD (PKT)
}): Promise<ActionResult> {
  if (!input.homeworkId) return { ok: false, error: 'Missing homework id.' };
  const supabase = createClient();
  const gate = await requireStaff(supabase);
  if (gate) return { ok: false, error: gate.error };

  const patch: Record<string, any> = {};
  if (input.title?.trim()) patch.title = input.title.trim();
  if (input.deadline) patch.deadline = new Date(`${input.deadline}T23:59:00+05:00`).toISOString();
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabase.from('homework').update(patch).eq('id', input.homeworkId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}

/** Soft-delete a homework (sets deleted_at). RLS enforces write permission. */
export async function deleteHomework(homeworkId: string): Promise<ActionResult> {
  if (!homeworkId) return { ok: false, error: 'Missing homework id.' };
  const supabase = createClient();
  const gate = await requireStaff(supabase);
  if (gate) return { ok: false, error: gate.error };

  const { error } = await supabase
    .from('homework')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', homeworkId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}

/**
 * Student submits their own homework. RLS (student_access_own_homework) ensures
 * a student can only touch their own rows. Marks 'late' if past the deadline,
 * else 'submitted' - both count as a submission; 'submitted' also counts as
 * on-time in the health formula. Refuses if already graded.
 */
export async function submitHomework(input: { homeworkId: string }): Promise<ActionResult> {
  if (!input.homeworkId) return { ok: false, error: 'Missing homework id.' };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  // Submission goes through the locked SECURITY DEFINER RPC (student_submit_homework):
  // it flips status to 'submitted'/'late' for the caller's OWN homework only and can
  // never touch the score or set 'graded'. Students have no direct UPDATE on homework.
  const { data: newStatus, error } = await supabase.rpc('student_submit_homework', {
    p_homework_id: input.homeworkId,
  });

  if (error) {
    // Pre-migration fallback: if the RPC isn't there yet, use the old direct path
    // (still gated by RLS to the student's own row) so submission keeps working.
    if (/function .*student_submit_homework.* does not exist/i.test(error.message)) {
      const { data: hw } = await supabase
        .from('homework')
        .select('deadline,status')
        .eq('id', input.homeworkId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!hw) return { ok: false, error: 'Homework not found (or not yours).' };
      if (hw.status === 'graded') return { ok: false, error: 'This homework has already been graded.' };
      const late = hw.deadline ? new Date(hw.deadline).getTime() < Date.now() : false;
      const { error: updErr } = await supabase
        .from('homework')
        .update({ status: late ? 'late' : 'submitted' })
        .eq('id', input.homeworkId);
      if (updErr) return { ok: false, error: updErr.message };
      revalidatePath('/homework');
      revalidatePath('/');
      return { ok: true, warning: late ? 'Submitted after the deadline (marked late).' : undefined };
    }
    const msg = /already been graded/i.test(error.message)
      ? 'This homework has already been graded.'
      : /not found/i.test(error.message)
      ? 'Homework not found (or not yours).'
      : 'Could not submit. Please try again.';
    return { ok: false, error: msg };
  }

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true, warning: newStatus === 'late' ? 'Submitted after the deadline (marked late).' : undefined };
}

/** Mark a homework graded (counts as on-time completion in the health formula). */
export async function gradeHomework(input: {
  homeworkId: string;
  score?: number;
}): Promise<ActionResult> {
  const supabase = createClient();
  const gate = await requireStaff(supabase);
  if (gate) return { ok: false, error: gate.error };

  const patch: Record<string, any> = { status: 'graded' };
  if (input.score != null && !Number.isNaN(input.score)) patch.score = input.score;

  const { data: updated, error } = await supabase
    .from('homework')
    .update(patch)
    .eq('id', input.homeworkId)
    .select('org_id,student_id,title')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  // Notify the student their homework was graded (in-app bell) - best-effort.
  if (updated?.org_id && updated?.student_id) {
    await notifyStudentById(updated.org_id as string, updated.student_id as string, {
      title: 'Homework graded',
      body: (updated.title as string) ?? '',
      link: '/homework',
    });
  }

  revalidatePath('/homework');
  revalidatePath('/');
  return { ok: true };
}
