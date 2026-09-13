-- FIX: admins could not record teacher payouts — RLS blocked the INSERT with
-- SQLSTATE 42501 ("You do not have permission to do that.").
--
-- Cause: the base schema's admin policy loop omitted `teacher_payouts`, so the
-- table had RLS enabled without a working admin write policy (the incremental
-- policy also lacked an explicit WITH CHECK for INSERT). Recreate the admin
-- policy with an explicit USING + WITH CHECK so an admin can read and write
-- payouts for their own org. Idempotent.

alter table public.teacher_payouts enable row level security;

drop policy if exists admin_full_access_teacher_payouts on public.teacher_payouts;
create policy admin_full_access_teacher_payouts on public.teacher_payouts
  for all
  using (current_user_role() = 'admin' and org_id = current_user_org_id())
  with check (current_user_role() = 'admin' and org_id = current_user_org_id());
