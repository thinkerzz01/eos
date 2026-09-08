-- ============================================================================
-- 2026-08-28  Editable subject codes
--
-- Adds a `code` column to subjects so the admin can set/edit each subject's
-- Cambridge (CAIE) code in the Subjects manager, and it shows in every picker
-- across the app. Backfilled with the standard O-Level codes (one per subject,
-- the academy's choice) verified against cambridgeinternational.org — editable
-- per row afterwards (e.g. to set the IGCSE/A-Level variant). Only fills blanks,
-- so it's safe to re-run.
-- ============================================================================

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;

UPDATE public.subjects s SET code = m.code
FROM (VALUES
    ('Mathematics', '4024'),
    ('Additional Mathematics', '4037'),
    ('Physics', '5054'),
    ('Chemistry', '5070'),
    ('Biology', '5090'),
    ('Accounting', '7707'),
    ('Economics', '2281'),
    ('Business Studies', '7115'),
    ('Computer Science', '2210'),
    ('Information Technology', '0417'),
    ('English (First Language)', '1123'),
    ('English (Second Language)', '0510'),
    ('Islamiyat', '2058'),
    ('Pakistan Studies', '2059'),
    ('Urdu', '3247'),
    ('Statistics', '4040'),
    ('Psychology', '0490'),
    ('Sociology', '2251')
) AS m(name, code)
WHERE s.name = m.name AND (s.code IS NULL OR s.code = '');
