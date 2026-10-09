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

---

## [2026-10-03] Phase 5 — Fixed-term commitment + "Student leaving" (one-month cases)

**Built:** Handle students who stay a fixed number of months (incl. one month) and clean early-exit.
- Convert/Enroll modal (monthly): new **Commitment** control — Ongoing (default) or Fixed N months. Fixed N sets an EXCLUSIVE billing end = start + N months, so exactly N cycles bill.
- Billing cron end rule made EXCLUSIVE (`nextDue >= end` skips), matching teacher-salary class_end. Removes the one-month off-by-one.
- Teacher salary now caps at the EARLIER of class_end_date and the student's billing_end_date, so a commitment/leaving date stops salary automatically (no per-enrollment edit).
- New **End / Student Leaving** action + modal on the Students list: sets billing_end_date (exclusive) from a chosen date (defaults to next_due_date); stops fees AND teacher salary together; marks student stopped if the date has passed. Reversible.
- "committed months" stays a note; the enforced stop is billing_end_date. Known short-term = monthly + N (not upfront), per owner.
**Files touched:** lib/cron/billing.ts, lib/data/teacherSalaries.ts, app/leads/actions.ts (convertLead commitmentMonths), app/leads/LeadsClient.tsx, app/students/actions.ts (endStudentBilling), app/students/StudentsClient.tsx.
**Tables / migrations:** none (uses existing billing_end_date / class_end_date columns).
**RLS:** unchanged; finance/student writes admin-scoped as before.
**Verified:** typecheck + production build clean. No regression for current data (no monthly student has a billing end set; earlierEnd returns the same class end).
**Deferred:** none.
**Gaps surfaced:** none.

## [2026-10-06] Phase 5 — Vouchers: "Copy Message" action

**Built:** Added a "Copy Message" item to the voucher row-actions menu (desktop + mobile) that copies the same WhatsApp fee text used by "Send to Student" to the clipboard, with a success toast and a window.prompt fallback when the Clipboard API is blocked. "Send to Student" already opens wa.me with the prefilled message; this gives a paste-anywhere copy for cases where wa.me does not prefill (desktop WhatsApp, etc).
**Files touched:** app/vouchers/VouchersClient.tsx
**Tables / migrations:** none (client-only).
**RLS:** unchanged.
**Verified:** typecheck clean (tsc 0). Message uses {{student_name}} data only, no hardcoded pronoun; manual copy/paste, not an automated send, so comms policy unaffected.
**Deferred:** none.
**Gaps surfaced:** none.

## [2026-10-06] Phase 5 — Vouchers: owner-approved WhatsApp fee message + Copy Message

**Built:** Rewrote the voucher WhatsApp/copy message to the owner-approved wording (Assalam o Alaikum + student name, "gentle fee reminder for <Level - Subject>", Billing period start-end, Fee amount, Amount due, Due date, receipt note, "JazakAllah, Team Thinkerzz"). Paid vouchers render a thank-you variant instead of a reminder. Added "Copy Message" row action (desktop + mobile) alongside the existing "Send to Student" (wa.me). Billing-period label reuses the existing billingPeriodLabel helper; "Level & Subject" = student program + comma-joined enrolled subject names.
**Files touched:** app/vouchers/VouchersClient.tsx, lib/data/vouchers.ts, lib/mockFinanceData.ts
**Tables / migrations:** none. getVouchers now embeds students.enrolled_at and student_subjects(subjects(name)) (RLS-scoped, deleted_at filtered in JS).
**RLS:** unchanged (finance admin-only; nested reads go through the same authorized voucher query).
**Acceptance criteria checked:** no hardcoded pronoun (none used); plain hyphens only; manual copy/paste send (comms policy unaffected); typecheck 0; production build 0.
**Deferred:** "How to pay" bank/wallet block removed per owner's final wording (was in the previous message). Can be re-added on request.
**Gaps surfaced:** none.

## [2026-10-09] Phase 5 — Delete a student now cleans up their vouchers (sync)

**Built:** Deleting a student now cascades to their fee vouchers + payments (soft-delete), so a removed student's fees drop out of the Fee Vouchers list, the dashboard Outstanding/Overdue, and everywhere finance reads filter deleted_at IS NULL - no more manual voucher deletion. Added read-side defense so a deleted student's vouchers are hidden even if the finance cascade could not write (e.g. a Manager-initiated delete) or for pre-existing orphans: getVouchers and the dashboard fee query now drop rows whose student is soft-deleted. Verified billing cron + generateMonthlyVouchers + forecast already exclude deleted/non-active students (they never created vouchers for deleted/passed-out students; the orphaned EXISTING vouchers were the real symptom).
**Files touched:** app/students/actions.ts (cascadeDeleteForStudents + revalidate /vouchers,/payments), lib/data/vouchers.ts, lib/data/adminDashboard.ts
**Tables / migrations:** supabase/migrations/2026-10-09_cleanup_orphan_vouchers.sql - soft-deletes vouchers+payments of already soft-deleted students (fixes current orphans / stale Outstanding). OWNER MUST RUN in Supabase SQL editor.
**RLS:** unchanged. Cascade runs under the caller's session (admin can write finance; Manager is denied -> best-effort no-op, read filter still hides). Cleanup migration runs as admin in SQL editor.
**Acceptance criteria checked:** soft-delete only (recoverable); all reads filter deleted_at; typecheck 0; build 0.
**Deferred / needs owner decision:** PASSOUT (markStudentPassout -> Alumni) already stops FUTURE billing but intentionally leaves existing unpaid vouchers as receivables (did not auto-wipe money owed). Owner to confirm whether passout should also cancel not-yet-due (Upcoming) unpaid vouchers. "Student leaving" (endStudentBilling) remains the clean exit that stops fees + teacher pay together.
**Gaps surfaced:** passout unpaid-voucher policy (above).

## [2026-10-09] Phase 5/6 — Full lifecycle sync (student + teacher) on stop/leave/delete

**Built:** Unified stop-cascade so leaving/passout/delete synchronise fees, salary, classes, calendar invites and reminders. Decision applied: NOT-YET-DUE unpaid vouchers (periods after the end, no payment) are auto-cancelled; real debt (already-due, or any voucher with a payment) is kept.
- Student DELETE: cascadeDeleteForStudents now uses service-role cancelFinanceForStudents -> soft-deletes vouchers + payments + student_subjects (works for Manager-initiated deletes too; removes them from teacher load/salary).
- Student PASSOUT (markStudentPassout) + bulk Alumni/Stopped: set billing_end_date=today (stops fees + salary), cancel future classes + Google Calendar invites (cancelFutureClassesForStudents from now), drop not-yet-due unpaid vouchers (cancelFutureVouchersForStudents). Re-activating (bulk Active) clears billing_end_date.
- Student LEAVING (endStudentBilling): now also cancels classes/invites on/after the end date + drops not-yet-due unpaid vouchers.
- Teacher load (teachers.ts + adminDashboard.ts): counts only ACTIVE, non-deleted students.
- Teacher side symmetry: markTeacherLeft now cancels the departed teacher's future classes/invites + unassigns demos (cancelScheduleForTeachers). Salary engine (teacherSalaries.ts) bounds accrual at teacher left_at (keeps owed back-pay, stops new cycles); forecast.ts excludes left/deleted teachers from projected salary.
**Files touched:** lib/scheduling/cascade.ts (new helpers: cancelFutureClassesForStudents, cancelFutureVouchersForStudents, cancelFinanceForStudents, pktDayStartISO), app/students/actions.ts, app/teachers/actions.ts, lib/data/teachers.ts, lib/data/adminDashboard.ts, lib/data/teacherSalaries.ts, lib/data/forecast.ts
**Tables / migrations:** supabase/migrations/2026-10-09_sync_stopped_students_left_teachers.sql - OWNER MUST RUN. Backfills billing_end_date for existing stopped students, cancels their + left teachers' future classes, drops their not-yet-due unpaid vouchers. (Google Calendar invites already sent for existing rows are not removed by SQL; new cascades handle invites going forward.)
**RLS:** cascade helpers use the service-role client (same pattern as cancelScheduleForStudents), so they run for admin + manager. Reads unchanged.
**Acceptance criteria checked:** soft-delete only; reminder cron already filters students.deleted_at (now classes are cancelled so stopped students drop out too); typecheck 0; build 0.
**Deferred:** reminder cron still keys off class_sessions/vouchers existence (correct) - no status filter needed now that stops cancel the underlying rows. Re-activating an individual via profile editor does not clear billing_end_date (only bulk Active does); flagged.
**Gaps surfaced:** none outstanding.

## [2026-10-09] Phase 6 — Orphan cleanup also cancels lingering Google Calendar invites

**Built:** Resolved the stop-cascade limitation (SQL cannot cancel already-sent Google invites). cleanupOrphanSchedule now also sweeps any ALREADY-cancelled (soft-deleted) class_session that still carries a calendar_event_id - the exact state the sync migration left stopped-students'/left-teachers' classes in - cancels the Google event (sendUpdates=all drops it off the family's/teacher's calendar) and clears the id. Paged at 200/run so a backlog cannot time out. Going-forward cancel helpers (cancelScheduleForStudents, cancelFutureClassesForStudents, cancelScheduleForTeachers, clearSessions) now also null calendar_event_id after cancelling, so invites are handled exactly once. Returns an added `invites` count. Trigger: existing Bearer-protected GET /api/cron/cleanup-orphans (run once; safe to re-run).
**Files touched:** lib/scheduling/cascade.ts
**Tables / migrations:** none.
**RLS:** unchanged (service-role maintenance endpoint, Bearer-token protected).
**Acceptance criteria checked:** idempotent (clears calendar_event_id so re-runs find nothing); best-effort try/catch; typecheck 0; build 0.
**Deferred:** cleanup-orphans is a manual/occasional endpoint (not on the 10-15 min cron). Owner runs it once to clear existing invites; could be added to the recurring tick later if desired.
**Gaps surfaced:** none.
