-- ============================================================================
-- 2026-09-19  Business expenses (for the Revenue / Finance tab)
-- ----------------------------------------------------------------------------
-- Teacher salaries were the only tracked cost, so any "profit" figure was really
-- just margin-after-salaries. This adds a simple expenses ledger (rent, ads,
-- utilities, software, misc) so the Finance tab can show a real profit:
--   profit = fees billed - teacher salaries earned - other expenses.
-- Admin only (finance is admin-scoped, same as vouchers/payments/payouts).
--
-- Idempotent. Paste into the Supabase SQL Editor and Run.
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  category text not null,               -- Rent | Ads | Utilities | Software | Salaries-other | Misc | ...
  amount numeric(10,2) not null,
  spent_on date not null default current_date,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_expenses_org_date on public.expenses(org_id, spent_on) where deleted_at is null;

-- keep updated_at fresh (same helper the schema uses)
drop trigger if exists trg_update_updated_at_expenses on public.expenses;
create trigger trg_update_updated_at_expenses before update on public.expenses
  for each row execute function update_updated_at_column();

-- RLS: admin full access within their org (finance is admin-only).
alter table public.expenses enable row level security;
drop policy if exists admin_full_access_expenses on public.expenses;
create policy admin_full_access_expenses on public.expenses
  for all using (current_user_role() = 'admin' and org_id = current_user_org_id());

-- Verify:
-- SELECT category, amount, spent_on, note FROM public.expenses ORDER BY spent_on DESC LIMIT 20;
