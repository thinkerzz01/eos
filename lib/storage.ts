// Private storage access (server-only). Storage buckets are PRIVATE; files are
// reached only via short-lived signed URLs generated server-side (AGENTS.md §3.3).
// This replaces the old fake `generateSignedStorageUrl` string builder in
// lib/security.ts with a real Supabase signed URL.
import { createClient } from '@/lib/supabase/server';

/**
 * Create a short-lived signed URL for a file in the private `documents` bucket.
 * Returns null if the object is missing or the caller lacks access (RLS/storage
 * policy). Never returns a fabricated URL.
 */
export async function getSignedDocumentUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
