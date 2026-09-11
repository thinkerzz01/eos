-- ============================================================================
-- 2026-09-11  Per-level subject codes (fix Cambridge levels + fill Edexcel IAL)
--
-- Earlier seeds put the O-Level code on EVERY Cambridge program. Codes actually
-- differ per level, so this sets the correct code per (subject, program):
--   O Level (O1/O2) -> O Level (4024 …)      IGCSE -> IGCSE (0580 …)
--   AS / A2         -> AS & A Level (9709 …)  Edexcel IGCSE -> Int GCSE (4MA1 …)
--   Edexcel AS      -> IAL cash-in X (XMA01 …)  Edexcel A2 -> IAL cash-in Y (YMA01 …)
-- For each program group it first blanks the code, then sets the offered subjects,
-- so a subject a level doesn't offer is left with NO (wrong) code. Idempotent.
-- Assumes the subject rows already exist (2026-09-11 subject seeds above it).
-- ============================================================================

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code TEXT;

-- 1. Cambridge O Level (O1 + O2)
UPDATE public.subjects SET code = NULL WHERE program IN ('O Level (O1)','O Level (O2)') AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','4024'),('Additional Mathematics','4037'),('Statistics','4040'),
    ('Physics','5054'),('Chemistry','5070'),('Biology','5090'),('Combined Science','5129'),
    ('Environmental Management','5014'),('Computer Science','2210'),('Accounting','7707'),
    ('Economics','2281'),('Business','7081'),('Business Studies','7115'),('Commerce','7100'),
    ('Geography','2217'),('History','2147'),('Sociology','2251'),('Global Perspectives','2069'),
    ('English (First Language)','1123'),('Literature in English','2010'),('Islamiyat','2058'),
    ('Islamic Studies','2068'),('Pakistan Studies','2059'),('Urdu','3247'),('Arabic','3180'),
    ('Art & Design','6090'),('Food & Nutrition','6065'),('Fashion & Textiles','6130')
) AS m(name,code) WHERE s.program IN ('O Level (O1)','O Level (O2)') AND s.name = m.name AND s.deleted_at IS NULL;

-- 2. Cambridge IGCSE
UPDATE public.subjects SET code = NULL WHERE program = 'IGCSE' AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','0580'),('Additional Mathematics','0606'),('Physics','0625'),
    ('Chemistry','0620'),('Biology','0610'),('Combined Science','0653'),('Marine Science','0697'),
    ('Environmental Management','0680'),('Computer Science','0478'),('Information Technology','0417'),
    ('Accounting','0452'),('Economics','0455'),('Business','0264'),('Business Studies','0450'),
    ('Commerce','0715'),('Geography','0460'),('History','0470'),('Sociology','0495'),
    ('Global Perspectives','0457'),('English (First Language)','0500'),('English (Second Language)','0510'),
    ('Literature in English','0475'),('Islamiyat','0493'),('Pakistan Studies','0448'),
    ('Urdu','0539'),('Arabic','0508'),('Art & Design','0400'),('Design & Technology','0445'),
    ('Drama','0411'),('Music','0410'),('Food & Nutrition','0648')
) AS m(name,code) WHERE s.program = 'IGCSE' AND s.name = m.name AND s.deleted_at IS NULL;

-- 3. Cambridge AS & A Level (AS + A2)
UPDATE public.subjects SET code = NULL WHERE program IN ('AS','A2') AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','9709'),('Further Mathematics','9231'),('Physics','9702'),('Chemistry','9701'),
    ('Biology','9700'),('Marine Science','9693'),('Environmental Management','8291'),
    ('Computer Science','9618'),('Information Technology','9626'),('Accounting','9706'),
    ('Economics','9708'),('Business','9609'),('Geography','9696'),('History','9489'),
    ('Sociology','9699'),('Psychology','9990'),('Law','9084'),('Global Perspectives & Research','9239'),
    ('Thinking Skills','9694'),('English (First Language)','9093'),('Literature in English','9695'),
    ('English General Paper','8021'),('Urdu','9676'),('Arabic','9680'),('Islamic Studies','9488'),
    ('Art & Design','9479'),('Design & Technology','9705'),('Media Studies','9607'),
    ('Drama','9482'),('Music','9483'),('Sport & Physical Education','9395')
) AS m(name,code) WHERE s.program IN ('AS','A2') AND s.name = m.name AND s.deleted_at IS NULL;

-- 4. Edexcel International GCSE
UPDATE public.subjects SET code = NULL WHERE program = 'Edexcel IGCSE' AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','4MA1'),('Additional Mathematics','4PM1'),('Further Mathematics','4PM1'),
    ('Physics','4PH1'),('Chemistry','4CH1'),('Biology','4BI1'),('Combined Science','4SD0'),
    ('Computer Science','4CP0'),('Information Technology','4IT1'),('Accounting','4AC1'),
    ('Economics','4EC1'),('Business','4BS1'),('Business Studies','4BS1'),('Commerce','4CM1'),
    ('Geography','4GE1'),('History','4HI1'),('English (First Language)','4EA1'),
    ('English (Second Language)','4EB1'),('Literature in English','4ET1'),('Islamiyat','4IS1'),
    ('Pakistan Studies','4PA1'),('Urdu','4UR0'),('Arabic','4AA1')
) AS m(name,code) WHERE s.program = 'Edexcel IGCSE' AND s.name = m.name AND s.deleted_at IS NULL;

-- 5. Edexcel International AS (IAS, X-prefix cash-in)
UPDATE public.subjects SET code = NULL WHERE program = 'Edexcel AS' AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','XMA01'),('Further Mathematics','XFM01'),('Physics','XPH11'),('Chemistry','XCH11'),
    ('Biology','XBI11'),('Economics','XEC11'),('Business','XBS11'),('Accounting','XAC11'),
    ('Information Technology','XIT01'),('Psychology','XPY01'),('Law','XLA01'),('Geography','XGE01'),
    ('History','XHI01'),('English (First Language)','XEN01'),('Literature in English','XET01')
) AS m(name,code) WHERE s.program = 'Edexcel AS' AND s.name = m.name AND s.deleted_at IS NULL;

-- 6. Edexcel International A Level (IAL, Y-prefix cash-in)
UPDATE public.subjects SET code = NULL WHERE program = 'Edexcel A2' AND deleted_at IS NULL;
UPDATE public.subjects s SET code = m.code FROM (VALUES
    ('Mathematics','YMA01'),('Further Mathematics','YFM01'),('Physics','YPH11'),('Chemistry','YCH11'),
    ('Biology','YBI11'),('Economics','YEC11'),('Business','YBS11'),('Accounting','YAC11'),
    ('Information Technology','YIT01'),('Psychology','YPY01'),('Law','YLA01'),('Geography','YGE01'),
    ('History','YHI01'),('English (First Language)','YEN01'),('Literature in English','YET01')
) AS m(name,code) WHERE s.program = 'Edexcel A2' AND s.name = m.name AND s.deleted_at IS NULL;

-- Verify:
-- SELECT program, name, code FROM public.subjects WHERE deleted_at IS NULL AND code IS NOT NULL ORDER BY program, name;
