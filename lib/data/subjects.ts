// Subjects data-access (RLS-enforced, server-only). Used for picker dropdowns.
import { createClient } from '@/lib/supabase/server';

export interface SubjectOption {
  id: string;
  name: string;
  program: string;
}

export async function getSubjects(): Promise<SubjectOption[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('subjects')
    .select('id,name,program')
    .is('deleted_at', null)
    .order('program', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as SubjectOption[];
}
