'use server';

// Subjects write actions. The subjects table is the source of truth for what a
// teacher/student can be enrolled in and what classes/homework reference. RLS
// gives admin + manager FOR ALL on subjects; everyone else is denied at the DB.
// We soft-delete (deleted_at) so past classes/homework that referenced a subject
// stay intact - the subject just drops out of the pickers.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ALL_PROGRAMS } from '@/lib/syllabiSeed';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface SubjectPick {
  id: string;
  name: string;
  program: string;
}

const PROGRAMS = ALL_PROGRAMS as readonly string[];

/**
 * List the live DB subjects for the enrollment pickers (teacher/student forms).
 * Callable from client components. Returns [] for an unauthenticated request.
 */
export async function listSubjects(): Promise<SubjectPick[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];
  const { data } = await supabase
    .from('subjects')
    .select('id,name,program')
    .is('deleted_at', null)
    .order('program', { ascending: true })
    .order('name', { ascending: true });
  return ((data as any[]) ?? []).map((s) => ({ id: s.id, name: s.name, program: s.program }));
}

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null as string | null, role: null as string | null };
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id,role')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  return { supabase, orgId: (profile?.org_id as string) ?? null, role: (profile?.role as string) ?? null };
}

export async function createSubject(input: { name: string; program: string }): Promise<ActionResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Subject name is required.' };
  if (!PROGRAMS.includes(input.program)) return { ok: false, error: 'Pick a valid program.' };

  const { supabase, orgId, role } = await ctx();
  if (!orgId) return { ok: false, error: 'You are not signed in.' };
  if (role !== 'admin' && role !== 'manager') {
    return { ok: false, error: 'Only an admin or manager can add subjects.' };
  }

  // If the same (name, program) already exists, revive it if soft-deleted, else
  // report a friendly duplicate rather than a raw DB error.
  const { data: existing } = await supabase
    .from('subjects')
    .select('id,deleted_at')
    .eq('org_id', orgId)
    .eq('name', name)
    .eq('program', input.program)
    .maybeSingle();
  if (existing?.id) {
    if (!existing.deleted_at) return { ok: false, error: 'That subject already exists for this program.' };
    const { error } = await supabase.from('subjects').update({ deleted_at: null }).eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('subjects').insert({ org_id: orgId, name, program: input.program });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/subjects');
  revalidatePath('/teachers');
  revalidatePath('/students');
  revalidatePath('/schedule');
  return { ok: true };
}

export async function updateSubject(input: { id: string; name?: string; program?: string }): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: 'Missing subject id.' };
  const { supabase, orgId, role } = await ctx();
  if (!orgId) return { ok: false, error: 'You are not signed in.' };
  if (role !== 'admin' && role !== 'manager') {
    return { ok: false, error: 'Only an admin or manager can edit subjects.' };
  }

  const patch: Record<string, any> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.program !== undefined) {
    if (!PROGRAMS.includes(input.program)) return { ok: false, error: 'Pick a valid program.' };
    patch.program = input.program;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update.' };

  const { error } = await supabase.from('subjects').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/subjects');
  revalidatePath('/teachers');
  revalidatePath('/students');
  revalidatePath('/schedule');
  return { ok: true };
}

/** Soft-delete a subject. Past classes/homework that referenced it are untouched. */
export async function deleteSubject(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing subject id.' };
  const { supabase, orgId, role } = await ctx();
  if (!orgId) return { ok: false, error: 'You are not signed in.' };
  if (role !== 'admin' && role !== 'manager') {
    return { ok: false, error: 'Only an admin or manager can delete subjects.' };
  }

  const { error } = await supabase
    .from('subjects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/subjects');
  revalidatePath('/teachers');
  revalidatePath('/students');
  revalidatePath('/schedule');
  return { ok: true };
}
