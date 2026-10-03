# Thinkerzz EOS — Progress & Status

_Last updated: 2026-08-07_

This file reflects the **actual, verified** state of the product. (An earlier
version claimed "100% COMPLETE — ALL 7 PHASES SHIPPED"; that referred to the UI
prototype on mock data and was inaccurate. See `AUDIT-REPORT.md` for the audit
that corrected it.)

Build health: `next build` passes (24/24 routes), `tsc --noEmit` clean.

---

## Where the product actually is

It is a **real, database-backed, RLS-secured app** — no longer a mock shell.

### ✅ Done and working

- **Authentication is real & deny-by-default.** `middleware.ts` redirects any
  unauthenticated request to `/login`. No demo-bypass cookie, no silent
  auto-signup — accounts are provisioned by an admin (`supabase/seed_admin.sql`).
- **Roles are server-authoritative.** The signed-in user's role is read from the
  `profiles` table server-side (`app/layout.tsx`) and passed down read-only;
  there is no client role switcher. RLS in the database is the real lock.
- **Read path — 16 screens fetch live data through RLS** via `lib/data/*` server
  queries + `<Screen>Client.tsx` splits (students, teachers, leads, demos,
  schedule, homework, assessments, tickets, announcements, audit-log,
  email-queue, fees, vouchers, payments, teacher-payouts, dashboard).
- **Write path — most forms persist** via `'use server'` actions: onboard/bulk
  student, create voucher / record payment / refund / grace decision, create &
  convert & edit lead, add teacher + set pay rate, assign demo (with real
  overlap re-check) + record outcome, create class + mark attendance, assign &
  grade homework, record test, post announcement, reply/resolve ticket, save
  settings. Health recomputes from real attendance/homework.
- **Public booking is wired.** `/book` books through the `create_public_booking`
  SECURITY DEFINER routine (anon-safe), creating a real lead + unassigned demo.
- **Phase 6 backend built.** Notification queue (`lib/notifications/*`), three
  Bearer-guarded cron routes (`app/api/cron/{reminders,send,monthly-reports}`),
  priority drain + 100/day cap + retries, pronoun-safe templates, and a monthly
  report that sends **first-name + facts only** to the LLM (no raw scores).
- **Real signed URLs** for the private document bucket (`lib/storage.ts`).

### ⚠️ Known limitations (documented, not yet built)

These are **additions** (new schema/tables/joins), not bugs:

- **Teacher-payouts "Approve" cannot persist** — the schema has `teacher_pay_rates`
  (rates) but no `payouts` table with a status. Needs a schema addition.
- Monthly-report `topicsCovered`, `gradeTrend`, and `assessedGrade` are
  placeholders until syllabus-progress and grade history are wired.
- Announcement audience, teacher subjects, and `assessed_grade`-at-test-time are
  not persisted (need their join tables).
- Documents vault has no UI yet (the signing helper `lib/storage.ts` is ready).
- Syllabus screen is CAIE reference/seed data (defensible).

---

## Go-live checklist (operator steps — not code)

1. Run `supabase/migrations/*` (schema) on the project if not already applied.
2. Create the first admin auth user, then run `supabase/seed_admin.sql`.
3. Run `supabase/seed_subjects.sql` (**required before any class can be scheduled**).
4. Turn OFF public sign-ups in Supabase Auth (admin-provisioned accounts only).
5. Set production env vars (Supabase keys, `CRON_SECRET_TOKEN`, `BOOKING_ORG_ID`,
   `RESEND_API_KEY`, `OPENROUTER_API_KEY`).
6. Point a scheduler (e.g. cPanel cron) at `/api/cron/reminders` and
   `/api/cron/send` every 10–15 min, and `/api/cron/monthly-reports` at
   month-end, each with `Authorization: Bearer $CRON_SECRET_TOKEN`.
7. Verify RLS denial per role with real test users (admin / manager / teacher /
   student) — per AGENTS.md §7.

---

## [2026-10-03] Phase 5 — Teacher payouts: per-cycle accrual + cumulative reconciliation

**Built:** Rewrote the teacher salary/payout engine to a permanent model.
- Accrual is now per CYCLE MONTH anchored to the class start day (6th→6th), not per
  calendar month. A class 17 Sep–17 Oct = one salary, not two. Fixes the
  double-count that inflated "earned"/"outstanding".
- `class_end_date` is EXCLUSIVE (a cycle starting on/after it is unpaid); blank =
  ongoing. One consistent meaning.
- Each cycle's pay is DUE 7 days after the cycle starts (owner rule: "paid in the
  second week / after seven days"). Surfaces an overdue-to-teacher figure.
- Reconciliation is CUMULATIVE: balance = earned-to-date − paid-to-date, matched by
  the payout's actual `paid_at` DATE, never the free-text `period` label. Every
  filter (month / All months) reconciles. Month view reads as a statement
  (opening + earned − paid = closing). Fixes "outstanding never clears" and the
  "All months" orphan-payout bug.
**Files touched:** `lib/data/teacherSalaries.ts` (rewrite), `app/teacher-payouts/actions.ts`
(period stamped from pay date; delete-by-paid_at month), `app/teacher-payouts/TeacherPayoutsClient.tsx`
(statement UI: opening/owed/overdue/overpaid; delete passes YYYY-MM).
**Tables / migrations:** no schema change to tables. Data migrations:
`2026-10-03_cleanup_removed_teacher_data.sql` (soft-delete enrollments+payouts of
removed teachers), `2026-10-03_fix_maaz_class_end.sql` (Maaz/Bilal end → 06 Oct 2026).
**RLS:** unchanged; payout tables remain admin-only (Manager denied).
**Verified:** typecheck + production build clean. Simulated the new statement vs live
data: Amina/Maaz/Zeeshan settle to 0; Salman shows overpaid 4,250 (commission is ON
for his cycle but he was paid the full salary).
**Deferred:** none.
**Gaps surfaced (needs a human decision):** Salman — turn OFF his 25% commission
(then settled) or treat the 4,250 as a real overpayment to recover.
