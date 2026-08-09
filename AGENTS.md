# AGENTS.md — Thinkerzz EOS

**Read this file completely before you touch anything. Every session. No exceptions.**

You are building **Thinkerzz EOS**, an academy operating system (CRM, scheduling, booking, syllabus, fees, four role portals).

This file is not documentation. It is the operating contract. If you skip it and start coding, you will silently break locked policy decisions that took multiple review rounds to settle, and the damage will not show up until it is expensive.

---

## 0. Session start ritual (mandatory, every new session)

Do these in order. Do not write a single line of code until all six are done.

1. **Read** `Thinkerzz-EOS-Master-Plan-v3.1.md` in full. Especially Section 2 (Decision Ledger).
2. **Read** `Thinkerzz-EOS-Developer-Complete-Guide-v3_1.md` Part A in full (A1 to A6). Part A is foundation and applies to every task.
3. **Read** the Part B section for the exact screen you are about to build. Only that screen.
4. **Read** `PROGRESS.md` (or create it, see Section 9) to see what is already done, what is half done, and what was deferred.
5. **State back**, in one short paragraph, what you are about to build, which phase it belongs to, and which locked rules apply to it. Do this in your response before any tool call that writes a file.
6. **Confirm the current phase.** If the task belongs to a later phase than the current one, say so and ask before proceeding.

If any of the two source documents is missing from the workspace, **stop and ask for it**. Do not reconstruct policy from memory, from the prototype, or from your own judgment.

---

## 1. Source of truth hierarchy

When two things disagree, this order decides. Always.

| Rank | Source | Authority |
|---|---|---|
| 1 | **Master Plan v3.1** | Wins on **policy**: rules, formulas, defaults, permissions, what the product is |
| 2 | **Developer Complete Guide v3.1** | Wins on **build detail**: columns, fields, layouts, actions, acceptance criteria |
| 3 | **PROGRESS.md / decision log** | Records what has actually been built and any newly approved decisions |
| 4 | **Existing code in the repo** | Evidence of intent, not authority. Code can be wrong. Documents cannot. |
| 5 | **The V3 portal prototype / demo** | **VISUAL REFERENCE ONLY** |

### About the demo / prototype

The demo is a **placeholder**. It exists to show layout, component shape, and flow.

- Do **not** copy its data, numbers, names, or seeded values into the real build.
- Do **not** treat a behaviour it shows as a specification.
- Do **not** treat a behaviour it is missing as out of scope.
- If the demo contradicts the Master Plan or Developer Guide, **the documents win, every time.**

### Your own judgment ranks last

You do not need to invent any policy. Every rule, formula, default, and permission has already been decided and written down. Do not "improve" a policy on your own. If something genuinely looks ambiguous or missing, **surface it and stop**. Do not guess and keep moving.

---

## 2. Before you start ANY task (pre-flight checklist)

Run this every task, not once per session.

- [ ] I have located this task in the **7 phase build order** (Master Plan §12 / Dev Guide E1) and I am not jumping ahead
- [ ] I have re-read the **Decision Ledger** entries that touch this task
- [ ] I have read the **exact Part B screen spec** for this screen, including its **Acceptance criteria** block
- [ ] I know which **tables** this task writes to, and I have their column lists from Part A2 open
- [ ] I know the **RLS rules** for those tables from A3, per role, including who is DENIED
- [ ] I have checked the **Locked (do not re-litigate)** list (Master Plan §13, Dev Guide E3) so I do not reopen a settled decision
- [ ] I have checked whether this task touches any **Global invariant** in Section 3 below
- [ ] I have checked `PROGRESS.md` so I do not rebuild or contradict something already shipped

If any box cannot be ticked, the answer is to go read, not to start.

---

## 3. Global invariants (apply to EVERY table, EVERY screen, EVERY task)

These are the things that get silently skipped. They are never optional.

### 3.1 Every table, without exception
- `id` (uuid pk)
- `org_id` (uuid) — multi-tenant from day one, on every single table
- `created_at` / `updated_at` (timestamptz, UTC, auto `updated_at` trigger)
- `deleted_at` (timestamptz null) — **soft delete**; every read filters `deleted_at IS NULL`
- Every meaningful write appends a row to the **append-only `audit_log`**

### 3.2 Time
- Store **all** timestamps in **UTC** (`timestamptz`)
- Display in **PKT (Asia/Karachi, +05:00)**
- **Never** compare local strings. Always compare stored UTC.

### 3.3 Security (this is the product, not polish)
- **RLS ON and deny-by-default on every table.** Enable RLS everywhere, then write explicit policies.
- Every policy also scopes by `org_id`.
- Hiding a sidebar tab or rendering a "locked" panel is **convenience**. RLS at the database is the **actual lock**. Never rely on the UI.
- **`teacher_pay_rates` is a SEPARATE table with Admin-only RLS.** Never merge pay into `teachers`. Postgres RLS is row-level, not column-level, and all Supabase users share the `authenticated` role, so hiding a column is not security.
- **Manager is DENIED at the database** on: all finance tables (`vouchers`, `payments`, `refunds`, `fee_decisions`), `settings`, `audit_log`, `teacher_pay_rates`. Do not even fetch that data for a Manager.
- **Cron secret goes in the `Authorization: Bearer` header.** Never in the query string.
- **Storage buckets are private.** Access only via short-lived signed URLs.
- **The public booking page can do exactly two things:** create a lead, and read open slots. It can read no student and no other booking. Ever.
- **Duplicate-phone / uniqueness checks must filter `deleted_at IS NULL`**; any unique index is partial.

### 3.4 Booking conflicts (two layers, both required)
- Layer 1: a time-range **`EXCLUDE` constraint** using `btree_gist` on `tstzrange(start_at, end_at)` per teacher, plus a per-slot capacity limit. A plain `(teacher, start_time)` unique index misses overlaps and is useless.
- Layer 2: an **application-level overlap re-check at the moment a teacher is assigned** (`doAssign`). Public bookings are created with NULL teacher, so the constraint cannot fire on them. Skipping this layer reopens the exact gap v3.1 was written to close.

### 3.5 Notifications
- **Nothing sends directly.** No feature ever calls Resend or Google Calendar. A feature writes a row to `notifications`; adapters drain the queue.
- Every row is **idempotent by `unique_key`**. Re-enqueuing the same event is a no-op.
- Every row carries **`priority` 1 / 2 / 3**. The sender drains 1 fully, then 2, then 3, up to the Resend 100/day cap.
- A failed send sets `status = failed`, increments `retry_count`, retries with backoff, and eventually surfaces on an admin panel. **Failures are never dropped silently.**
- Message templates use `{{student_name}}` and a `{{pronoun}}` merge field from the student's gender. **No hardcoded gendered pronoun anywhere.**

### 3.6 AI usage inside the product
- The LLM is used for **one thing only: phrasing the monthly report.**
- It receives **first name and facts only**. Never surname, never phone.
- It **never invents or changes a number.** Our code assembles the final report.
- **There is no AI syllabus upload or parsing.** It was considered and explicitly removed. Do not add it back.

---

## 4. Locked decisions you must not re-litigate

If your solution requires changing any of these, you have the wrong solution. Stop and ask.

**Fees**
- No late fees, ever. Statuses are Paid / Due / In Grace / Stopped.
- 3-day grace after the due date. Grace boundary includes the grace-deadline date; overdue begins the day after.
- **Paying within the 3-day grace = 100 on fee timeliness.** The old "in grace = 70" tier is removed.
- **Grace expiry never auto-stops a student.** It raises a "Fees need a decision" card for the Admin: Stop / Extend / Mark paid. Every choice audited.
- Partial payment = multiple `payments` rows against one voucher; the voucher stays **Due** with a running balance.
- Refund = a **negative payment** linked to the original voucher with a reason, audited. The original payment is never edited or deleted.
- Fee amount is a flexible manual value. There is no per-subject price table.
- Due date anchors to the enrolment day.

**Grades**
- Cambridge / CAIE scale: A*, A, B, C, D, E, U.
- `target_grade` defaults to **A***, set by Admin at enrollment.
- `assessed_grade` is **blank until the first test**, then set by the teacher after each test. It is a genuine assessed grade, not a prediction.
- The Result Slip shows three separately labelled things: internal average, assessed grade, target grade.
- The monthly report references only the assessed-grade **trend** (up / same / down).

**Monthly report**
- **No raw test scores.** Only topics covered, a **count** of tests conducted, and the grade trend.

**Scoring**
- `Health = 0.50 x Attendance% + 0.30 x HomeworkCompletion% + 0.20 x FeeTimeliness%`. No test scores in health.
- Attendance% = (present + 0.5 x late) / total completed classes x 100
- HomeworkCompletion% = on-time submitted-or-graded / total assigned x 100; **100 if none assigned**
- Bands: green >= 80, amber 60 to 79, red < 60
- Cold start: < 4 completed classes = "Not enough data", excluded from at-risk
- **The health engine and the fee badge must both read `students.fee_status`.** One source. They can never disagree.
- `TeacherScore = 0.45 x Rating% + 0.35 x DemoConversion% + 0.20 x Reliability%`
- DemoConversion% is a rolling 90-day window, excluding pending / no-show / reassigned
- Teacher cold start: < 5 completed demos = "Building record"

**Teachers**
- **Only the main Admin adds teachers and sets capacity.** Managers cannot. Capacity has no pre-filled default.
- **Capacity is a soft warning, not a hard block.** Show a confirm, proceed on confirmation, **audit the override**.
- **New teacher defaults are all 0 and display as the word "New"**, never a red zero. Teachers earn their scores.

**Syllabus**
- Versioned master data: `syllabus_templates` (program + subject + academic year) with `syllabus_topics` under each.
- Stored **once** and shared. Students never get a private copy of the topic list, only progress ticks in `syllabus_progress`.
- A yearly change creates a **new template version**. The old one is archived, never edited. Existing students keep their enrolled version until their exam.

**Roles and access**
- **Parent and student share one login.** The parent manages everything for the student. A separate student login is a future `role` addition, not a rebuild, and is **not built now**.
- Four roles: admin / manager / teacher / student.

**Scheduling**
- Class type is Class / Makeup / Test.
- A **Makeup** replaces a missed class, is **not charged again**, and is tracked separately so it never counts as a paid class.
- Filters: date range (Today / Week / Month / custom), teacher, student, subject, type, status.

**Infrastructure**
- `thinkerzz.com` = WordPress marketing site, **untouched**. `portal.thinkerzz.com` = the Next.js app. `thinkerzz.com/book` = public booking page.
- cPanel **Custom** cron (not the PHP wp-cron type), calling a secret app endpoint every 10 to 15 minutes.
- Vercel Hobby cron cannot run reminders. Do not propose it.
- Ticket reply is a **1-hour target, not a guarantee**, across 7 AM to 11 PM. Past-target tickets flag red.

---

## 5. Build order (do not jump phases)

1. **Foundation** — Supabase project, all tables with the global columns, RLS deny-by-default, auth, four roles, `teacher_pay_rates` separate
2. **Core records** — Students, Teachers, Subjects, syllabus templates and topics preloaded, `student_subjects` with target and assessed grade
3. **Admissions** — Leads CRM, Demos with conflict re-check, public Booking page, Convert
4. **Academics** — Schedule with EXCLUDE constraint and filters and makeup type, class completion flow (mobile first, partial-save safe), Homework, Tests and assessed grade
5. **Money** — Vouchers, payments, partial, refund, fee cycle with grace-then-Admin-decision, defaulters. Admin only.
6. **Intelligence** — Reports, Marketing, monthly report, notification queue with priority and retry, cron reminders
7. **Support and polish** — Tickets, Announcements, Documents vault, Settings, polish

Phases 1 and 2 can start immediately. Nothing blocks them.

Building a Phase 5 screen while Phase 1 RLS is incomplete is how finance data leaks. Do not do it.

---

## 6. During the task

- **Implement exactly what is written.** No extra fields, no extra tables, no extra screens, no "while I was in there" refactors.
- **Follow the shared component patterns in A6.** Build them once: grouped sidebar with role visibility and count badges, top bar with the global "+ Add" menu, KPI tiles, Action Center cards, data tables with per-row actions and empty states, filter chips plus search, two-column modal forms with inline validation, side drawer with inner tabs, bottom-center toasts, confirm dialogs for destructive actions and for the capacity override, and the locked access panel.
- **Do not invent UI patterns** when an existing one covers the case.
- **Empty states and edge cases are part of the spec**, not polish. Every Part B screen has an Edge cases block. Implement it.
- **If you hit a genuine gap**, write it down, surface it clearly to the user, and stop that thread. Do not fill it with an assumption.
- **Do not delete or rewrite working code** to make your change fit. Extend it.
- **Never bypass RLS** with a service-role key to make something work in the UI. If it needs the service role, that is a design smell. Say so.

---

## 7. Definition of done (per task)

A task is not done until every one of these is true:

- [ ] It satisfies the **Acceptance criteria block** in the Developer Guide for that screen, item by item, and I have checked them one by one
- [ ] RLS is enabled and explicitly policied on every table touched, and I have **tested the denial case**, not just the allow case (for example: a Manager token cannot read `vouchers`)
- [ ] Global columns present: `org_id`, `created_at`, `updated_at`, `deleted_at`, and audit_log writes
- [ ] All reads filter `deleted_at IS NULL`
- [ ] All timestamps stored UTC, displayed PKT
- [ ] No hardcoded pronouns; merge fields used
- [ ] No policy was invented, changed, or "improved"
- [ ] `PROGRESS.md` updated with what was built, what was deferred, and any gap surfaced

---

## 8. Master acceptance checklist (the system-level gate)

Re-verify these whenever you touch the relevant area. From Dev Guide E2.

1. RLS on for every table, deny-by-default. A Manager token cannot read any finance table, settings, audit_log, or teacher pay.
2. A public booking can only create a lead and read open slots. Nothing else.
3. Assigning one teacher to two separately created NULL-teacher demos at overlapping times is **blocked** by the assignment-time re-check.
4. A brand-new teacher shows "New", not 0 or red, for rating, demos, load, reliability.
5. Assigning past capacity warns, proceeds only on confirm, and audits the override.
6. `target_grade` defaults to A* at enrollment. `assessed_grade` is blank until the first test, then teacher-set. Both show on the Result Slip on the A* to U scale.
7. Paying within the 3-day grace scores 100. The health number and the fee badge always agree because both read `fee_status`.
8. A partial payment keeps the voucher Due with a running balance. A refund is a negative payment linked to the voucher, audited.
9. Message templates use `{{student_name}}` and `{{pronoun}}`. No hardcoded gendered pronoun anywhere.
10. The exam countdown computes from real dates and shows "Session complete" if past. **Never a negative number.**
11. The notification sender drains priority 1 before 2 before 3, respects the 100/day cap, and sends are idempotent by `unique_key`.
12. The monthly report contains no raw test scores.
13. One login serves parent and student. The parent sees only their own child, everywhere.
14. Every timestamp stored UTC and displayed PKT. The cron uses the `Authorization: Bearer` secret, not the query string.

---

## 9. PROGRESS.md (maintain this, every task)

Keep a running file at the repo root. Append, never rewrite history.

```markdown
## [YYYY-MM-DD] Phase N — <task name>

**Built:** <what actually exists now>
**Files touched:** <paths>
**Tables / migrations:** <names>
**RLS:** <policies added, and the denial case tested>
**Acceptance criteria checked:** <list, ticked>
**Deferred:** <what was intentionally left, and why>
**Gaps surfaced (needs a human decision):** <question, or "none">
```

At the start of every session, read this file before anything else in the codebase.

---

## 10. When to STOP and ask

Stop immediately, and ask, if any of the following is true:

- A requirement seems ambiguous after checking **both** documents
- The correct implementation would require changing a **locked** decision
- The Master Plan and Developer Guide appear to conflict on something that is **not** a clean policy-versus-detail split
- The demo shows something the documents do not mention, and you are tempted to build it
- You would need a service-role key or an RLS bypass to make a feature work
- A free-tier ceiling is about to be hit (Supabase ~500 MB DB and 1 GB storage, Resend 100/day)
- The task touches one of the **open items**: meeting-link method (Meet or Zoom, manual or generated), the meaning of "months committed" and early-exit policy, ticket-target staffing, or whether `target_grade` should later default per program

Surfacing a gap costs one message. Guessing wrong costs a rebuild.

---

## 11. The one-line summary

**Read the Master Plan for policy, the Developer Guide for build detail, treat the demo as a placeholder, never invent a rule, never trust the UI as a lock, and stop and ask the moment something is unclear.**
