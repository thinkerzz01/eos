// Server guard for the Settings route. The page itself is a client component, so
// the role check lives here (route-segment layouts render on the server). RLS is
// still the real lock on settings data; this stops a non-admin from loading the
// admin settings shell by URL.
import { requireRole } from '@/lib/auth/requireRole';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['admin']);
  return <>{children}</>;
}
