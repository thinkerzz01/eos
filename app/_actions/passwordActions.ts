'use server';

// Admin/manager-initiated password reset actions. Enforces WHO may reset WHOM:
//   - teacher password: admin only
//   - student password: admin or manager
// then delegates to the server-only helpers. Passwords are never read - only reset.
// Targets the person by their teacher/student record id (stable), not email.
import { createClient } from '@/lib/supabase/server';
import { sendResetById, setTempById } from '@/lib/auth/passwordReset';

export interface ResetResult {
  ok: boolean;
  error?: string;
  tempPassword?: string; // present only when mode = 'temp'
  email?: string; // the login email (for display), when mode = 'temp'
}

async function callerRole(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase.rpc('current_user_role');
  return (role as string) ?? null;
}

export async function adminResetPassword(input: {
  id: string;
  kind: 'teacher' | 'student';
  mode: 'email' | 'temp';
}): Promise<ResetResult> {
  const role = await callerRole();
  if (!role) return { ok: false, error: 'You are not signed in.' };

  const allowed =
    input.kind === 'teacher' ? role === 'admin' : role === 'admin' || role === 'manager';
  if (!allowed) {
    return {
      ok: false,
      error:
        input.kind === 'teacher'
          ? 'Only an admin can reset a teacher password.'
          : 'Only an admin or manager can reset a student password.',
    };
  }

  if (input.mode === 'email') {
    const r = await sendResetById(input.kind, input.id);
    return { ok: r.ok, error: r.error };
  }
  const r = await setTempById(input.kind, input.id);
  return { ok: r.ok, error: r.error, tempPassword: r.password, email: r.email };
}
