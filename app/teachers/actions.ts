'use server';

// Teachers write actions. LOCKED POLICY: only the Admin adds teachers and sets
// capacity (Managers cannot). RLS also enforces this - the teachers table gives
// Manager SELECT-only - but we check role here too for a friendly error.
// New teachers start every score at 0 (DB defaults) and render as "New".
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { provisionLogin } from '@/lib/auth/provision';

export interface ActionResult {
  ok: boolean;
  error?: string;
  // Set when the core write succeeded but the portal invite email did not send.
  warning?: string;
}

export async function createTeacher(input: {
  name: string;
  email: string;
  phone: string;
  city?: string;
  capacity: string | number;
  joinDate?: string;
}): Promise<ActionResult> {
  const name = input.name?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  const capacity =
    typeof input.capacity === 'number' ? input.capacity : parseInt(input.capacity, 10);

  if (!name || !email || !phone) {
    return { ok: false, error: 'Name, email, and phone are required.' };
  }
  if (!capacity || Number.isNaN(capacity) || capacity <= 0) {
    return { ok: false, error: 'Enter a valid capacity (max active students).' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') {
    return { ok: false, error: 'Only an Admin can add teachers and set capacity.' };
  }

  const row: Record<string, any> = {
    org_id: profile.org_id,
    name,
    email,
    phone,
    city: input.city?.trim() || null,
    capacity,
    status: 'available',
    // rating / demos_given / demos_converted / reliability default to 0 -> "New"
  };
  if (input.joinDate) row.join_date = input.joinDate;

  const { data: inserted, error } = await supabase
    .from('teachers')
    .insert(row)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Auto-provision the teacher's portal login (best-effort: a mail/quota failure
  // must not undo the teacher we just created).
  let warning: string | undefined;
  const invite = await provisionLogin({
    email,
    name,
    role: 'teacher',
    orgId: profile.org_id,
    teacherId: inserted.id,
  });
  if (!invite.ok) {
    warning = `Teacher added, but the portal invite could not be sent: ${invite.error}`;
  }

  revalidatePath('/teachers');
  revalidatePath('/');
  return { ok: true, warning };
}

/**
 * Set a teacher's per-class pay rate. LOCKED: teacher_pay_rates is the isolated
 * Admin-only table (Managers/Teachers are denied at the DB). Inserts a new rate
 * row (effective_from defaults to today) so history is preserved.
 */
export async function setTeacherPayRate(input: {
  teacherId: string;
  ratePerClass: number;
}): Promise<ActionResult> {
  if (!input.teacherId) return { ok: false, error: 'Teacher is required.' };
  if (!(input.ratePerClass > 0)) return { ok: false, error: 'Enter a valid per-class rate.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };
  if (profile.role !== 'admin') {
    return { ok: false, error: 'Only an Admin can set teacher pay rates.' };
  }

  const { error } = await supabase.from('teacher_pay_rates').insert({
    org_id: profile.org_id,
    teacher_id: input.teacherId,
    rate_per_class: input.ratePerClass,
    // effective_from defaults to CURRENT_DATE
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/teachers');
  revalidatePath('/teacher-payouts');
  return { ok: true };
}
