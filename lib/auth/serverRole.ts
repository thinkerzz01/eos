import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/components/layout/Sidebar';

const VALID: UserRole[] = ['admin', 'manager', 'teacher', 'student'];

// Authoritative role, resolved server-side. Wrapped in React cache() so that if
// several server components in the SAME request need it (e.g. the root layout AND
// the dashboard page), the DB round-trip runs ONCE per request, not once each.
// Presence check uses getSession() (local, no network); role uses the SECURITY
// DEFINER RPC. Defaults to 'student' (least privilege) on any failure / no session.
export const getServerRole = cache(async (): Promise<UserRole> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return 'student';
    const { data: role } = await supabase.rpc('current_user_role');
    return VALID.includes(role as UserRole) ? (role as UserRole) : 'student';
  } catch {
    return 'student';
  }
});

// The signed-in user's own display name. For a teacher/student we resolve it from
// their AUTHORITATIVE record (teachers/students table) so a renamed person shows
// their real name even if their profiles row still holds an old/seeded name (e.g.
// the "Test Teacher" seed). Admin/manager fall back to profiles.name.
// Cached per request; returns '' when unknown so callers can fall back.
export const getServerUserName = cache(async (): Promise<string> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, role, teacher_id, student_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!profile) return '';

    // Teacher: name-only RPC (RLS blocks a teacher from reading the teachers table
    // directly; this SECURITY DEFINER function returns id+name for their own id).
    if ((profile as any).role === 'teacher' && (profile as any).teacher_id) {
      const { data } = await supabase.rpc('teacher_names', { ids: [(profile as any).teacher_id] });
      const nm = (data as any[])?.[0]?.name;
      if (nm) return nm as string;
    }
    // Student: student_read_own_profile RLS lets them read their own students row.
    if ((profile as any).role === 'student' && (profile as any).student_id) {
      const { data: st } = await supabase
        .from('students')
        .select('name')
        .eq('id', (profile as any).student_id)
        .is('deleted_at', null)
        .maybeSingle();
      if ((st as any)?.name) return (st as any).name as string;
    }
    return ((profile as any).name as string) ?? '';
  } catch {
    return '';
  }
});
