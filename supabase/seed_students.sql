-- ============================================================================
-- Thinkerzz EOS — Sample students (so the wired /students screen shows data)
-- Run AFTER seed_admin.sql, in Supabase Dashboard -> SQL Editor.
-- Idempotent-ish: re-running adds duplicates only if you change the names.
-- ============================================================================

INSERT INTO public.students
    (org_id, name, parent_name, phone, whatsapp, email, gender, program,
     exam_session, monthly_fee, fee_status, next_due_date, status, source)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Zainab Abbas',  'Mr. Abbas Ali',   '+92 300 1112221', '+92 300 1112221', 'abbas@example.com',  'female', 'O Level',  'May/June 2027', 18000, 'paid',     CURRENT_DATE + 20, 'active', 'google'),
    ('00000000-0000-0000-0000-000000000001', 'Hassan Raza',   'Mrs. Raza Bibi',  '+92 301 2223332', NULL,              'raza@example.com',   'male',   'A Level',  'Oct/Nov 2026',  22000, 'due',      CURRENT_DATE + 3,  'active', 'referral'),
    ('00000000-0000-0000-0000-000000000001', 'Ayesha Khan',   'Mr. Khan Sahib',  '+92 302 3334443', '+92 302 3334443', NULL,                 'female', 'IGCSE',    'May/June 2027', 20000, 'in_grace', CURRENT_DATE - 1,  'active', 'instagram'),
    ('00000000-0000-0000-0000-000000000001', 'Bilal Ahmed',   'Mrs. Ahmed',      '+92 303 4445554', NULL,              'ahmed@example.com',  'male',   'O Level',  'May/June 2027', 18000, 'stopped',  CURRENT_DATE - 10, 'paused', 'walk_in'),
    ('00000000-0000-0000-0000-000000000001', 'Fatima Noor',   'Mr. Noor Ul Haq', '+92 304 5556665', '+92 304 5556665', 'noor@example.com',   'female', 'A Level',  'Oct/Nov 2026',  25000, 'paid',     CURRENT_DATE + 25, 'active', 'facebook');

-- Verify:
-- SELECT name, program, fee_status, status FROM public.students WHERE deleted_at IS NULL;
