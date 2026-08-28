// Name-only teacher resolver for portal views (server-only).
// ---------------------------------------------------------------------------
// The `teachers` table is admin/manager-only under RLS, so a class/homework row
// that embeds `teachers(name)` returns NULL for students and teachers. To let a
// student see WHICH teacher takes a class (name only, never phone/email) we call
// the `teacher_names` SECURITY DEFINER RPC, which returns id+name scoped to the
// caller's org and exposes no contact columns. See the 2026-08-28 migration.
import { createClient } from '@/lib/supabase/server';

/**
 * Resolve a set of teacher ids to their display names. Returns a Map keyed by
 * teacher id. Best-effort: any error (or the RPC not yet migrated) yields an
 * empty Map, so callers fall back to whatever the embed gave them.
 */
export async function resolveTeacherNames(
  supabase: ReturnType<typeof createClient>,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;

  const { data, error } = await supabase.rpc('teacher_names', { ids: unique });
  if (error || !data) return out;
  for (const row of data as { id: string; name: string }[]) {
    if (row?.id && row?.name) out.set(row.id, row.name);
  }
  return out;
}
