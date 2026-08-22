// Reads the org's chosen fonts (Settings → Typography) for the root layout.
// Uses the session client: every role can read its own org row (RLS), so the
// fonts apply for all roles. Fails safe to the defaults for unauthenticated
// pages (login/book) or if the typography migration hasn't been applied yet.
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from '@/lib/fonts';

export interface Typography {
  headingFont: string;
  bodyFont: string;
}

export async function getTypography(): Promise<Typography> {
  const fallback: Typography = { headingFont: DEFAULT_HEADING_FONT, bodyFont: DEFAULT_BODY_FONT };
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return fallback;

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', session.user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!profile?.org_id) return fallback;

    const { data: org, error } = await supabase
      .from('orgs')
      .select('heading_font,body_font')
      .eq('id', profile.org_id)
      .maybeSingle();
    if (error || !org) return fallback;

    return {
      headingFont: (org as any).heading_font || DEFAULT_HEADING_FONT,
      bodyFont: (org as any).body_font || DEFAULT_BODY_FONT,
    };
  } catch {
    return fallback;
  }
}
