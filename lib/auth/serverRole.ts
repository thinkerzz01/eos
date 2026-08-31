import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/components/layout/Sidebar';

const VALID: UserRole[] = ['admin', 'manager', 'teacher', 'student'];

export interface Identity {
  role: UserRole;
  name: string;
  orgId: string | null;
  teacherId: string | null;
  studentId: string | null;
}

// ONE per-request read of the signed-in user's profile (role + name + links).
// Wrapped in React cache() so every server component in the SAME request (root
// layout, the page, requireRole, data layers) shares a SINGLE DB round-trip
// instead of each doing its own. Presence check uses getSession() (local, no
// network). Reading role from `profiles` directly (own_profile_read RLS) replaces
// the previous separate current_user_role RPC call — one query, not two, on every
// navigation. Defaults to least-privilege 'student' on any failure / no session.
export const getServerIdentity = cache(async (): Promise<Identity> => {
  const EMPTY: Identity = { role: 'student', name: '', orgId: null, teacherId: null, studentId: null };
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return EMPTY;
    const { data } = await supabase
      .from('profiles')
      .select('role, name, org_id, teacher_id, student_id')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return EMPTY;
    const role = VALID.includes((data as any).role) ? ((data as any).role as UserRole) : 'student';
    return {
      role,
      name: ((data as any).name as string) ?? '',
      orgId: ((data as any).org_id as string) ?? null,
      teacherId: ((data as any).teacher_id as string) ?? null,
      studentId: ((data as any).student_id as string) ?? null,
    };
  } catch {
    return EMPTY;
  }
});

// Authoritative role, resolved server-side (from the shared identity read).
export const getServerRole = cache(async (): Promise<UserRole> => {
  return (await getServerIdentity()).role;
});

// The signed-in user's own display name. For a teacher/student we resolve it from
// their AUTHORITATIVE record (teachers/students table) so a renamed person shows
// their real name even if their profiles row still holds an old/seeded name (e.g.
// the "Test Teacher" seed). Admin/manager use profiles.name. Reuses the cached
// identity read; only teacher/student add one extra name lookup.
export const getServerUserName = cache(async (): Promise<string> => {
  try {
    const id = await getServerIdentity();

    // Teacher: name-only RPC (RLS blocks a teacher from reading the teachers table
    // directly; this SECURITY DEFINER function returns id+name for their own id).
    if (id.role === 'teacher' && id.teacherId) {
      const supabase = createClient();
      const { data } = await supabase.rpc('teacher_names', { ids: [id.teacherId] });
      const nm = (data as any[])?.[0]?.name;
      if (nm) return nm as string;
    }
    // Student: student_read_own_profile RLS lets them read their own students row.
    if (id.role === 'student' && id.studentId) {
      const supabase = createClient();
      const { data: st } = await supabase
        .from('students')
        .select('name')
        .eq('id', id.studentId)
        .is('deleted_at', null)
        .maybeSingle();
      if ((st as any)?.name) return (st as any).name as string;
    }
    return id.name;
  } catch {
    return '';
  }
});
