// My Syllabus - SERVER Component. A student's read-only view of their own
// syllabus coverage (Phase 3). PARKED: the whole syllabus module is admin/manager
// only for now, so this route is blocked to students (and everyone else) until we
// re-enable the student view. The code is kept so we can turn it back on by
// restoring requireRole(['student']) and the sidebar link. RLS scopes the data to
// the signed-in student when it is re-enabled.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Parked: the whole syllabus module is admin/manager only for now, so this route
// redirects everyone away. The student view lives in MySyllabusClient +
// lib/data/studentSyllabus.ts (getMySyllabus) and can be turned back on by
// restoring the getServerIdentity/requireRole(['student']) fetch here and the
// "My Syllabus" sidebar link.
export default async function MySyllabusPage() {
  redirect('/');
}
