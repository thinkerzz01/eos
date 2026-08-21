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
