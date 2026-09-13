// Subjects data-access (server-only). Used for picker dropdowns. The org's subject
// list changes rarely, so the read is cached per org and busted on subject
// create/edit/delete via the 'subjects' tag. Org is resolved per-request
// (cookie-based) OUTSIDE the cache; the cached loader reads the org's subjects with
// the cookie-free service-role client (filtered by org_id), so it is safe inside
// unstable_cache.
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerIdentity } from '@/lib/auth/serverRole';

export interface SubjectOption {
  id: string;
  name: string;
  program: string;
  code?: string; // Cambridge (CAIE) subject code, admin-editable
}

const loadSubjects = (orgId: string) =>
  unstable_cache(
    async (): Promise<SubjectOption[]> => {
      const admin = createAdminClient();
      // Try with the `code` column; fall back if the migration hasn't been applied.
      const rich = await admin
        .from('subjects')
        .select('id,name,program,code')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('program', { ascending: true })
        .order('name', { ascending: true });
      if (!rich.error && rich.data) return rich.data as SubjectOption[];

      const basic = await admin
        .from('subjects')
        .select('id,name,program')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('program', { ascending: true })
        .order('name', { ascending: true });
      return (basic.data as SubjectOption[]) ?? [];
    },
    ['subjects', orgId],
    { revalidate: 3600, tags: ['subjects'] }
  );

export async function getSubjects(): Promise<SubjectOption[]> {
  try {
    const { orgId } = await getServerIdentity();
    if (!orgId) return [];
    return await loadSubjects(orgId)();
  } catch {
    return [];
  }
}
