// Reads the org's chosen fonts (Settings → Typography) for the root layout.
// This runs on EVERY page, so the org row read is cached (org fonts change rarely)
// and busted on save via the 'org-config' tag. The org is resolved per-request
// (cookie-based) OUTSIDE the cache; the cached loader reads with the cookie-free
// service-role client (org config is global, not per-user), so it is safe inside
// unstable_cache. Fails safe to the defaults for anonymous pages / pre-migration.
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerIdentity } from '@/lib/auth/serverRole';
import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from '@/lib/fonts';

export interface Typography {
  headingFont: string;
  bodyFont: string;
}

const FALLBACK: Typography = { headingFont: DEFAULT_HEADING_FONT, bodyFont: DEFAULT_BODY_FONT };

const loadTypography = (orgId: string) =>
  unstable_cache(
    async (): Promise<Typography> => {
      const admin = createAdminClient();
      const { data } = await admin
        .from('orgs')
        .select('heading_font,body_font')
        .eq('id', orgId)
        .maybeSingle();
      return {
        headingFont: (data as any)?.heading_font || DEFAULT_HEADING_FONT,
        bodyFont: (data as any)?.body_font || DEFAULT_BODY_FONT,
      };
    },
    ['typography', orgId],
    { revalidate: 3600, tags: ['org-config'] }
  );

export async function getTypography(): Promise<Typography> {
  try {
    const { orgId } = await getServerIdentity();
    if (!orgId) return FALLBACK;
    return await loadTypography(orgId)();
  } catch {
    return FALLBACK;
  }
}
