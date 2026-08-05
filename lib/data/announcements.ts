// Announcements data-access — RLS-enforced, server-only.
import { createClient } from '@/lib/supabase/server';
import type { AcademyAnnouncement } from '@/lib/mockSupportData';

function mapRow(r: any): AcademyAnnouncement {
  return {
    id: r.id,
    title: r.title,
    content: r.body,
    targetAudience: 'All',   // announcement_targets join (later slice)
    publishedDate: r.created_at,
    isPinned: false,
    authorName: '',          // profiles join (later slice)
  };
}

export async function getAnnouncements(): Promise<AcademyAnnouncement[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select('id,title,body,posted_by,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
