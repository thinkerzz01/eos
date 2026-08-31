import 'server-only';
import { redirect } from 'next/navigation';
import { getServerRole } from '@/lib/auth/serverRole';
import type { UserRole } from '@/components/layout/Sidebar';

// Server-side route guard for role-restricted pages. RLS is still the real lock
// on the DATA (a non-admin gets no rows even without this), but this stops a
// signed-in non-admin from loading an admin page shell by typing its URL.
// getServerRole() is cache()'d per request, so calling this adds no extra DB round
// trip when the layout already resolved the role. Redirects to the dashboard.
export async function requireRole(allowed: UserRole[]): Promise<UserRole> {
  const role = await getServerRole();
  if (!allowed.includes(role)) redirect('/');
  return role;
}
