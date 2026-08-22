# Security & Linter Notes

This file records the Supabase database-linter findings that are **intentionally
left in place**, and why. It exists so that a future review (or auditor) does
not mistake a deliberate design decision for an overlooked gap.

Last reviewed: 2026-08-22.

---

## ✅ Fixed

| Finding | Fix | Migration |
|---------|-----|-----------|
| `function_search_path_mutable` (12 functions) | Pinned `search_path = public, pg_temp` on every SECURITY DEFINER / trigger function | `2026-08-22_linter_hardening.sql` |
| Trigger fns callable via `/rpc/` by anon/authenticated (`audit_log_trigger_func`, `update_updated_at_column`) | Revoked `EXECUTE` from PUBLIC/anon/authenticated | `2026-08-22_linter_hardening.sql` |
| `auth_rls_initplan` (6 policies) | Wrapped `auth.uid()` as `(SELECT auth.uid())` so it evaluates once per query | `2026-08-22_perf_lints.sql` |
| Targeted unindexed FKs on hot paths (~20) | Added covering indexes | `2026-08-22_perf_lints.sql` |
| `auth_leaked_password_protection` | Enabled HaveIBeenPwned check in Supabase Auth dashboard | (dashboard toggle) |

---

## 🟢 Intentionally NOT changed (accepted)

### 1. `multiple_permissive_policies` — ~515 findings, PERFORMANCE, WARN
**What it is:** Each table carries a separate *permissive* RLS policy per role
(`admin_full_access_*`, `manager_access_*`, `teacher_read_*`, `student_read_*`).
The linter emits one row per (table × role × action × policy) combination, so
one design decision across ~30 tables expands to hundreds of findings.

**Why it's safe:** Permissive policies are OR-ed together — that is exactly the
intended semantics ("admin OR manager OR teacher OR student may see their
slice"). There is no security or correctness issue; the only cost is that
Postgres evaluates each role's `USING` clause per row.

**Why we leave it:** At this scale (dozens of teachers, hundreds–low-thousands
of students) the per-row overhead is negligible. The only "fix" is collapsing
each table's per-role policies into a single combined policy — a large, risky
RLS rewrite where a mistake means a data leak or a lockout. Not worth it
pre-launch. **Revisit only if row counts reach the tens of thousands.**

### 2. Unindexed foreign keys — ~59 remaining, INFO, PERFORMANCE
We indexed the ~20 FK columns actually used in hot RLS subqueries, joins, and
the notification bell (see `2026-08-22_perf_lints.sql`). The rest are cold
columns and `org_id`. `org_id` has near-zero selectivity in an effectively
single-org database, so an index on it would never be chosen by the planner and
would only slow writes. Indexing cold FKs is premature at this scale.

### 3. Public-form RPCs executable by `anon` — by design
`create_public_booking`, `submit_enrollment`, `submit_onboarding`,
`get_student_public`, `get_open_slots`, `student_submit_homework` are
`SECURITY DEFINER` and **meant** to be callable without login — they power the
public booking / enrollment / onboarding / homework-submission forms. Each
performs its own internal authorization. Revoking `EXECUTE` would break those
public flows.

### 4. `current_*` helpers executable by `authenticated` — by design
`current_user_role`, `current_user_org_id`, `current_teacher_id`,
`current_student_id` are referenced by RLS policies on nearly every table, so
signed-in users **must** retain `EXECUTE` or row security breaks everywhere.
They only ever return the caller's *own* role/org/id, so there is no data leak.

### 5. `extension_in_public` — `btree_gist` — accepted
`btree_gist` backs the `EXCLUDE` constraint that prevents double-booking on
class sessions. Moving an in-use extension between schemas is risky and yields
no meaningful security benefit.

---

## Re-running the linter
After the two migrations above and the leaked-password toggle, expect the
Security and Performance advisors to drop to only the items in the
"Intentionally NOT changed" list. Those are known and accepted — not gaps.
