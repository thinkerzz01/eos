-- Bring EXISTING records in line with the new stop-cascade (students who were
-- already passed-out/left, and teachers already marked 'left', before the app
-- cascade existed). Soft-delete only, recoverable, idempotent.
--
-- NOTE: this cancels the DB rows that drive class emails + billing. Google Calendar
-- invites already sent for those classes are NOT removed here (that needs the Google
-- API); the in-app cascade cancels invites for all future stops. Run in the Supabase
-- SQL editor (admin).

begin;

-- 1) Give every stopped (alumni/left) student a billing end date if they lack one,
--    so fees + teacher salary stop accruing for them (billing_end_date is the lever).
update students
   set billing_end_date = current_date
 where status = 'stopped'
   and deleted_at is null
   and billing_end_date is null;

-- 2) Cancel FUTURE classes of stopped students (stops the "class starting soon"
--    emails the reminder cron would otherwise send them).
update class_sessions c
   set status = 'cancelled', deleted_at = now()
  from students s
 where c.student_id = s.id
   and s.status = 'stopped'
   and s.deleted_at is null
   and c.deleted_at is null
   and c.start_at >= now();

-- 3) Cancel FUTURE classes taught by a teacher who has left.
update class_sessions c
   set status = 'cancelled', deleted_at = now()
  from teachers t
 where c.teacher_id = t.id
   and t.status = 'left'
   and t.deleted_at is null
   and c.deleted_at is null
   and c.start_at >= now();

-- 4) Soft-delete NOT-YET-DUE unpaid vouchers of stopped students (fees for periods
--    on/after their end date that they will not attend). Keeps any voucher that has
--    a payment on it (real, partially-settled debt) and anything already due.
update vouchers v
   set deleted_at = now()
  from students s
 where v.student_id = s.id
   and s.status = 'stopped'
   and s.deleted_at is null
   and v.deleted_at is null
   and v.status <> 'paid'
   and v.due_date >= coalesce(s.billing_end_date, current_date)
   and not exists (
     select 1 from payments p where p.voucher_id = v.id and p.deleted_at is null
   );

commit;
