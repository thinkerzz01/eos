-- ============================================================================
-- Thinkerzz EOS — Create one test voucher (so you can try the finance flow)
-- Run AFTER seed_admin.sql and seed_students.sql, in Supabase SQL Editor.
-- Creates a 'due' voucher for the first student, then you can Record Payment /
-- Refund / make a grace Decision on the Vouchers screen and watch it persist.
-- ============================================================================
DO $$
DECLARE
    v_org     UUID := '00000000-0000-0000-0000-000000000001';
    v_student UUID;
    v_name    TEXT;
BEGIN
    SELECT id, name INTO v_student, v_name
    FROM public.students
    WHERE deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'No students found. Run seed_students.sql first.';
    END IF;

    INSERT INTO public.vouchers
        (org_id, student_id, voucher_no, period, amount, due_date, grace_deadline, status, reference_note)
    VALUES
        (v_org, v_student,
         'VCH-' || to_char(now(), 'YYYYMM') || '-001',
         to_char(now(), 'Mon YYYY'),
         20000,
         CURRENT_DATE + 5,
         CURRENT_DATE + 8,
         'due',
         'Use the voucher number as your payment reference.');

    RAISE NOTICE 'Voucher created for % (PKR 20000, due in 5 days).', v_name;
END $$;

-- Verify:
-- SELECT voucher_no, amount, status FROM public.vouchers WHERE deleted_at IS NULL;
