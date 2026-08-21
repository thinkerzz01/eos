'use server';

// Global search used by the TopBar. Searches students, teachers and leads by
// name / phone / email. RLS scopes results to what the caller may see (a teacher
// gets their own students, no leads, etc.), so no extra role checks are needed.
import { createClient } from '@/lib/supabase/server';

export interface SearchHit {
  id: string;
  label: string; // primary text (name)
  sub: string; // secondary text (phone/email/program)
  link: string; // where clicking goes
}

export interface SearchResults {
  students: SearchHit[];
  teachers: SearchHit[];
  leads: SearchHit[];
}

const EMPTY: SearchResults = { students: [], teachers: [], leads: [] };

// Keep only characters safe inside a PostgREST `or=(...ilike...)` filter.
function sanitize(q: string): string {
  return q.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = sanitize(query ?? '');
  if (q.length < 2) return EMPTY;

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return EMPTY;

  const like = `%${q}%`;
  const orExpr = `name.ilike.${like},phone.ilike.${like},email.ilike.${like}`;

  const [stu, tea, led] = await Promise.all([
    supabase.from('students').select('id,name,phone,program').is('deleted_at', null).or(orExpr).limit(6),
    supabase.from('teachers').select('id,name,phone,email').is('deleted_at', null).or(orExpr).limit(6),
    supabase.from('leads').select('id,name,phone,program').is('deleted_at', null).or(orExpr).limit(6),
  ]);

  return {
    students: ((stu.data as any[]) ?? []).map((s) => ({
      id: s.id, label: s.name, sub: [s.program, s.phone].filter(Boolean).join(' · '), link: '/students',
    })),
    teachers: ((tea.data as any[]) ?? []).map((t) => ({
      id: t.id, label: t.name, sub: [t.email, t.phone].filter(Boolean).join(' · '), link: '/teachers',
    })),
    leads: ((led.data as any[]) ?? []).map((l) => ({
      id: l.id, label: l.name, sub: [l.program, l.phone].filter(Boolean).join(' · '), link: '/leads',
    })),
  };
}
