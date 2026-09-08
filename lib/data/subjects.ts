// Subjects data-access (RLS-enforced, server-only). Used for picker dropdowns.
import { createClient } from '@/lib/supabase/server';

export interface SubjectOption {
  id: string;
  name: string;
  program: string;
  code?: string; // Cambridge (CAIE) subject code, admin-editable
}

export async function getSubjects(): Promise<SubjectOption[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  // Try with the `code` column; fall back if the migration hasn't been applied
  // yet so the pickers never break.
  const rich = await supabase
    .from('subjects')
    .select('id,name,program,code')
    .is('deleted_at', null)
    .order('program', { ascending: true })
    .order('name', { ascending: true });
  if (!rich.error && rich.data) return rich.data as SubjectOption[];

  const basic = await supabase
    .from('subjects')
    .select('id,name,program')
    .is('deleted_at', null)
    .order('program', { ascending: true })
    .order('name', { ascending: true });
  if (basic.error || !basic.data) return [];
  return basic.data as SubjectOption[];
}
