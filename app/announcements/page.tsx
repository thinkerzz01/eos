// Announcements — SERVER Component (real, RLS-authorized rows -> client UI).
import { getAnnouncements } from '@/lib/data/announcements';
import { AnnouncementsClient } from './AnnouncementsClient';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements();
  return <AnnouncementsClient initialAnnouncements={announcements} />;
}
