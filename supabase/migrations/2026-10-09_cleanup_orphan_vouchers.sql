-- Clean up finance rows orphaned by student deletes that happened BEFORE the
-- delete->voucher cascade existed. A soft-deleted student used to leave their
-- fee vouchers (and the payments against them) behind, so those vouchers kept
-- showing in the Fee Vouchers list and counting toward the dashboard's
-- Outstanding. This soft-deletes (recoverable) any voucher + payment whose
-- student is already soft-deleted. Idempotent: re-running changes nothing new.
--
-- Run in the Supabase SQL editor (admin). Safe: soft delete only, no hard delete.

begin;

-- 1) Soft-delete payments against vouchers whose student is soft-deleted.
update payments p
   set deleted_at = now()
  from vouchers v
  join students s on s.id = v.student_id
 where p.voucher_id = v.id
   and p.deleted_at is null
   and s.deleted_at is not null;

-- 2) Soft-delete the vouchers themselves whose student is soft-deleted.
update vouchers v
   set deleted_at = now()
  from students s
 where v.student_id = s.id
   and v.deleted_at is null
   and s.deleted_at is not null;

commit;

-- Verify (should return 0 rows): live vouchers still attached to a deleted student.
-- select v.id, v.code, v.period, v.amount, s.name
--   from vouchers v join students s on s.id = v.student_id
--  where v.deleted_at is null and s.deleted_at is not null;
