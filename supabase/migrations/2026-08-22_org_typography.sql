-- ============================================================================
-- Settings → Typography: let the admin choose the heading + body fonts.
-- Stored on `orgs` (not `settings`) because every role can read their org row,
-- so the chosen fonts apply for admins, teachers and students alike. The app
-- falls back to Nunito (headings) + Jost (body) when these are null.
-- Values are font KEYS from lib/fonts.ts (e.g. 'nunito', 'jost', 'inter',
-- 'poppins', 'lora'). Run once in the Supabase SQL Editor.
-- ============================================================================
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS heading_font TEXT,
  ADD COLUMN IF NOT EXISTS body_font TEXT;
