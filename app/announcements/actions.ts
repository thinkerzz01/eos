'use server';

// Announcements write action. RLS: admin + manager may post (teacher/student
// denied at the DB). Audience targeting (announcement_targets) is program/
// student based in the schema, not the All/Students/Teachers/Parents enum the
// UI uses, so audience is not persisted here yet — follow-up.
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createAnnouncement(input: {
  title: string;
  content: string;
}): Promise<ActionResult> {
  const title = input.title?.trim();
  const body = input.content?.trim();
  if (!title || !body) return { ok: false, error: 'Title and body are required.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You are not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!profile?.org_id) return { ok: false, error: 'No organisation profile found.' };

  const { error } = await supabase.from('announcements').insert({
    org_id: profile.org_id,
    title,
    body,
    posted_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/announcements');
  return { ok: true };
}
