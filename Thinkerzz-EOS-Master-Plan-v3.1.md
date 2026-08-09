# Thinkerzz EOS — Master Plan

**Academy Operating System · CRM, Scheduling, Booking, Syllabus, Fees & Portals**

Question · Think · Achieve

**Version 3.1 (Final, expanded).** This is the single authoritative plan. It holds the vision, every decision, the full data model, the screen inventory, and the architecture. The **Developer Complete Guide** is the exhaustive tab-by-tab build companion; the **portal prototype (V3)** is the clickable reference. Where any disagree, this document wins on policy and the Developer Guide wins on build detail.

> **What changed from v3.0 → v3.1** (all decided and locked in the review rounds):
> 1. **CAIE grade tracking added** — `target_grade` (default A\*, Admin sets at enrollment) and `assessed_grade` (teacher assigns after each test, A\*–U scale) on `student_subjects`.
> 2. **Fee-timeliness scoring changed** — paying within the 3-day grace now scores **100** (fully on time). The old "in grace = 70" tier is **removed**.
> 3. **Syllabus is now versioned master data** — `syllabus_templates` keyed by program + subject + year, with `syllabus_topics` under each. No per-student copies, no AI-upload parsing.
> 4. **Booking conflict re-check at assignment** — an application-level overlap check runs the moment a teacher is assigned (closes the NULL-teacher gap).
> 5. **New-teacher defaults locked** — rating, demos, load, reliability all start at 0 and display as "New" until earned.
> 6. **Teacher capacity = soft warning**, not a hard block; the override is audited.
> 7. **Resend overflow = priority queue** (time-critical reminders first).
> 8. **One login (parent) LOCKED** — no longer an open item.
> 9. **1-hour ticket SLA = a target (not a guarantee), 7 AM–11 PM.**
> 10. **Partial payment and refund LOCKED** — no longer open items.
> 11. **Schedule filters + makeup class type** specified.
> 12. **Domain split** — marketing on `thinkerzz.com`, app on `portal.thinkerzz.com`, public booking at `thinkerzz.com/book`.

---

## 1. What we are building and why

Thinkerzz EOS is one system that runs the whole academy: it captures every inquiry, books demos from a public page, converts leads into students, runs the daily teaching loop (attendance, syllabus, homework, tests), handles fees and vouchers, and keeps parents informed through automatic messages and a monthly progress report.

The product's promise to parents is trust: their child's data is safe, fee handling is transparent, and every month they receive a clear, warm report of their child's progress. The monthly report is the single feature parents will pay to keep, so retention is built around it.

The academy is one organisation today, but the system is multi-tenant from day one (`org_id` on every table) so it can be sold to other academies later with no migration.

---

## 2. Decision ledger

Every decision, in one place. Final unless changed here.

### Fees and grace
- **No late fees.** Outcomes are only Paid, an extended grace, or Stopped. Statuses: Paid / Due / In Grace / Stopped.
- **3-day grace** after the due date.
- **Paying within the 3-day grace counts as fully on time** — no penalty anywhere, including the health score. (Changed in v3.1; see 6.1.)
- **Grace expiry does NOT auto-stop.** It raises a "Fees need a decision" card and notifies the Admin, who decides.
- **Admin is given options** at that point: Stop the seat, Extend the grace, or Mark paid. The system never stops a student on its own. Every choice is audited.
- **Partial payment (locked):** records the amount paid; the voucher balance stays **Due** until fully paid. Shown as a running balance on the voucher.
- **Refund (locked):** a **negative payment** linked to the original voucher, with a reason, fully audited. Never edits or deletes the original payment.
- Fee amount is a **flexible manual value** (e.g. Rs 20,000 for two subjects), not a per-subject price table.
- Due date **anchors to the enrolment day** (join 15th, due 15th).
- **Grace boundary rule (locked):** in grace = from the due date up to **and including** the grace-deadline date; overdue begins the **day after** the grace deadline.

### CAIE grade tracking (new in v3.1)
- The academy teaches to the **Cambridge / CAIE scale: A\*, A, B, C, D, E, U.**
- Each `student_subjects` row carries two grades on that scale:
  - **`target_grade`** — the goal. **Defaults to A\***, set by **Admin at enrollment**. (Configurable per student; a per-program default may be introduced later.)
  - **`assessed_grade`** — a **genuine grade the teacher assigns after testing** (not a prediction/forecast). **Blank until the first test**, then updated by the teacher at each test cycle.
- The **Result Slip** shows three things side by side, clearly labelled as separate scales: **internal average** (A/B/C from raw test scores), **Cambridge assessed grade**, and **target grade**.
- The **monthly parent report** references only the **assessed-grade trend** (up / same / down), never a raw restated number — consistent with the "no raw test scores in the report" rule.

### Syllabus (revised in v3.1)
- The syllabus is stored as **versioned master data**, not in code and not copied per student.
- **`syllabus_templates`** = one row per **program + subject + academic year** (e.g. "A Level Physics 9702 · 2026").
- **`syllabus_topics`** = the official topic list under each template (one row per topic).
- A student's `student_subjects` row **points to a template version**; their per-topic ticks live in `syllabus_progress`. The master is stored once and shared by all students in that subject.
- **Yearly change = a new template version.** Existing students keep the version they enrolled on until their exam; new students get the new version. Old data is never overwritten.
- **No AI syllabus-upload/parsing feature.** (Considered and explicitly removed — it risked inconsistent topic naming across students and unreliable reporting. Topic lists are pre-loaded as reference data and maintained by Admin.)

### Monthly report and AI
- The report is **complete** (attendance, homework completion, syllabus topics, teacher note, next-month focus, exam countdown, health score, assessed-grade trend) but **contains no raw test scores**. It mentions only the **number of tests conducted**.
- An optional free LLM only **phrases** the report; it never invents or changes a number.
- The LLM receives **first name and facts only** (no surname, no phone). Our own code assembles the final report with the full name. The complete report reaches the parent; the child's full identity never goes to a free third-party endpoint.

### Scoring (formulas in section 6)
- **Health score** = retention risk (attendance + homework completion + fee timeliness). No test scores.
- **Academic performance** is **separate** (test scores, syllabus, homework grades, assessed grade). It lives in the Result Slip.
- **Teacher score** = 45% Rating + 35% Demo-conversion + 20% Reliability.
- **New-teacher defaults (locked):** a newly added teacher starts at **rating 0, demos given 0, demos converted 0, current load 0, reliability 0**, and every one of these displays as **"New"** (not a red zero) until the teacher has a real track record. Teachers **earn** their scores.
- **Cold start:** students < 4 completed classes show "Not enough data" (excluded from at-risk); teachers < 5 completed demos show "Building record".

### Teachers and capacity
- **Only the main Admin adds teachers and sets each teacher's capacity.** Managers cannot add teachers or set capacity. Capacity has **no pre-filled default** — the Admin types it per teacher.
- **Capacity is a soft warning, not a hard block.** Assigning a student past a teacher's capacity shows a confirm ("Teacher is at capacity — assign anyway?"); it proceeds only on confirmation and the **override is audited**.

### Scheduling
- Class **type** is one of **Class / Makeup / Test**.
- A **Makeup** is a replacement for a missed class (student absent or teacher cancelled). It is **not charged again** and is tracked separately so it never counts as a paid class. A "pending makeups" count appears on the dashboard.
- **Schedule filters:** date range (Today / Week / **Month** / custom), teacher, student, subject, type, and status (Scheduled / Completed / Cancelled / No-show).

### Marketing and sources
- **No paid ads at launch.** Focus is SEO (organic Google). Ad-spend stays zero and cost-per-student stays blank until ads begin.
- **Booking-form source order:** Google (top), Facebook, Instagram, WhatsApp, Referral (plus Walk-in for manual entry).

### Support
- **Ticket reply is a 1-hour target, not a hard guarantee, across 7 AM–11 PM.** Busy periods may run longer; tickets past the target are flagged red on the dashboard. (Staffing to support this is an operational item, not a technical one.)

### Notifications
- **Resend free tier caps at 100 emails/day.** Overflow is handled by a **priority queue**: priority 1 = time-critical (class-in-15-minutes, fee-due-today); priority 2 = transactional (receipts, confirmations); priority 3 = FYI/marketing. The cron sends priority 1 first, then 2, then 3, until the cap. Priority 3 overflow waits for the next run. Crossing 100 priority-1 emails/day is the signal to upgrade Resend.

### Roles and login
- **Parent and student share one login (LOCKED).** The parent manages everything for the student. A separate student login can be added later as a `role` addition, not a rebuild — but it is **not** built now and is **removed from open items**.

### Hosting, domain and infrastructure
- **Domain split (locked):** `thinkerzz.com` = WordPress marketing site (SEO untouched); **`portal.thinkerzz.com`** = the Next.js EOS app (on Vercel/Cloudflare); **`thinkerzz.com/book`** = public demo booking page. The cron lives on cPanel and calls the app over the internet — two surfaces to monitor if reminders ever stop.
- **cPanel Custom cron is confirmed available.** Use the Custom type (not the PHP wp-cron type). It calls a secret app endpoint every 10-15 minutes.
- **Vercel Hobby cron cannot run reminders** (daily only). Fallbacks if ever needed: Cloudflare Workers cron (free, per-minute) or pg_cron.

### Security corrections (locked into the build)
- **Teacher pay is a separate table** (`teacher_pay_rates`) with its own RLS. Postgres RLS is row-level, not column-level, and all Supabase users share the `authenticated` role, so hiding a column is not secure.
- **Cron secret goes in the `Authorization: Bearer` header**, not the query string.
- **Duplicate-phone checks filter `deleted_at IS NULL`**; any unique index is partial.
- **Booking conflicts use a time-range `EXCLUDE` constraint** (btree_gist) on `tstzrange(start_at, end_at)` per teacher, plus a per-slot capacity limit. A plain `(teacher, start_time)` unique index misses overlaps and is inert for NULL-teacher public bookings.
- **NULL-teacher conflict re-check (new in v3.1):** because a public booking is created with no teacher, the EXCLUDE constraint cannot fire on it. An **application-level overlap check runs at the moment a teacher is assigned** to a demo or class (`doAssign`). It blocks the assignment if the chosen teacher already has any session overlapping `[start_at, end_at)`.

---

## 3. System architecture

### 3.1 Technology stack
- **App:** Next.js (Vercel or Cloudflare free tier), all four portals in one codebase, gated by role. Served at `portal.thinkerzz.com`.
- **DB / Auth / Storage:** Supabase (free tier) — Postgres + RLS, email/password auth, private buckets.
- **Cron:** cPanel Custom cron -> secret app endpoint every 10-15 min.
- **Email:** Resend free tier (3,000/month, 100/day, one verified domain) with a priority queue.
- **AI:** OpenRouter free tier (swappable), **report phrasing only** (first-name-and-facts only). (Syllabus AI-parsing was removed in v3.1.)

### 3.2 The notification queue (critical pattern)
Nothing sends directly. Any event writes a row into `notifications`; channel adapters read the queue and deliver. Channels can be switched or WhatsApp Cloud API added later without touching feature code.

Channel priority (Settings): Google Calendar invite (primary, free) -> Email (Resend) -> WhatsApp wa.me (manual) -> WhatsApp Cloud API (later, only a new adapter). Every send is idempotent by `unique_key`. Each queued row carries a **`priority` (1/2/3)**; the sender drains priority 1 first. A **failed** state + retry counter retries and then surfaces failures, never dropping them silently.

### 3.3 Reminders (cron)
`GET /api/cron/reminders` (Authorization: Bearer header) every 10-15 min enqueues: classes in 15 minutes, fees due today, grace ending tomorrow, follow-ups. `GET /api/cron/monthly-reports` at month-end. `GET /api/cron/backup-export` weekly. All comparisons use stored UTC. The sender respects the priority queue and the Resend 100/day cap.

### 3.4 Non-negotiable data rules (every table)
`org_id`, `timestamptz` (store UTC, display PKT), soft delete via `deleted_at`, auto `updated_at`, and an append-only `audit_log` on every meaningful write.

### 3.5 Free-tier ceilings
Supabase ~500 MB DB and 1 GB file storage (document vault + report snapshots grow — decide Supabase Storage vs Cloudflare R2 and when to move to paid). Resend 100/day cap (handled by the priority queue). Weak free-tier backup — run a weekly export via the cron that already exists.

---

## 4. Data model overview

Every table carries the global columns from 3.4. Full column lists are in the Developer Guide (Part A2). The entities and their key fields:

**Identity & org:** `orgs` (name, timezone, academic_year); `profiles` (user_id, role[admin/manager/teacher/student], name, email, phone, student_id?, teacher_id?).

**Core records:** `subjects` (name, program, has_syllabus); **`syllabus_templates` (program, subject_id, academic_year, cambridge_code, status[active/archived])** — the versioned master; **`syllabus_topics` (template_id, name, sort)** — official topic list under a template; `teachers` (name, contact, capacity, status, rating, demos_given, demos_converted, reliability — all default 0/"New"); `teacher_subjects`; `teacher_pay_rates` (separate, Admin-only RLS); `teacher_leave`; `students` (name, parent, contact, program, exam_session, enrolled_at, months_committed, status, monthly_fee, fee_status, next_due_date); **`student_subjects` (student, subject, teacher, syllabus_template_id, `target_grade` default 'A\*', `assessed_grade` nullable)** — teacher and template can differ per subject; `syllabus_progress` (student, topic, state[covered/plan/na], covered_at).

**Admissions:** `leads` (names, contact, program, subjects, source, utm, status, temperature, assigned_manager, next_follow_up, lost_reason, converted_student_id); `lead_communications`; `demos` (lead, subject, teacher?, scheduled_at, meeting_link, status, outcome, reason).

**Academics:** `class_sessions` (student, subject, teacher, **type[class/makeup/test]**, start_at, end_at, status, meeting_link — EXCLUDE constraint per teacher; assignment-time overlap re-check for NULL-teacher rows); `attendance` (session, student, status[present/late/absent]); `class_notes` (session, note, topics_covered[]); `homework` (student, subject, teacher, title, deadline, status, score); `tests` (student, subject, name, date, score — separate academic record; teacher sets `assessed_grade` on `student_subjects` after a test).

**Money:** `vouchers` (student, voucher_no[partial unique], period, amount, due_date, grace_deadline, status, reference_note); `voucher_lines`; `payments` (voucher, amount, method, reference, screenshot_url, reconciled_by — **partial payments are multiple rows against one voucher**); `refunds` (**negative payment linked to a voucher, reason, audited**); `fee_decisions` (voucher, decision[stop/extend/paid], by — audit of grace choices); `payment_accounts` (Settings).

**Communication, support, growth:** `notifications` (queue: type, channels, **priority[1/2/3]**, payload, status[queued/sent/failed], retry_count, unique_key); `announcements` + `announcement_targets`; `tickets` + `ticket_messages` (1-hour target); `documents` (private bucket, signed URLs — vault for results, past papers, payment screenshots); `referrals`; `ad_spend` (manual, zero until ads); `settings`; `audit_log` (append-only).

---

## 5. Roles, portals and permissions

Four roles. Parent is folded into the Student role (**one login serves both — LOCKED**). Every permission is enforced with RLS, deny-by-default. Hiding a menu is convenience; RLS is the lock.

- **Admin:** everything. The only role that adds teachers, sets capacity, touches finance, and touches Settings.
- **Manager:** runs the academy day-to-day; blocked from Finance/Vouchers, Settings, Staff pay, and the Audit log — enforced by RLS. Cannot add teachers or set capacity.
- **Teacher:** own classes and own students only; no financial data. Assigns the CAIE assessed grade after tests, ticks syllabus, marks attendance, assigns homework.
- **Student/Parent:** own summary, schedule, syllabus (read-only), homework (submit), fees (own only), documents (own), tickets (raise own), announcements.

**Permission map (sidebar visibility):** Dashboard (all); Leads CRM, Demos, Booking, Teachers, Reports, Marketing, Announcements (Admin + Manager); Students (Admin + Manager full, Teacher own); Schedule (Admin + Manager full, Teacher + Student own); My Syllabus (Student); Homework, Tests & Results (Admin + Manager full, Teacher + Student own); Documents vault (Admin + Manager full, Student own); Fees & Vouchers, Settings (Admin only, plus a parent's own fees).

The full RLS matrix (per table, per role) is in the Developer Guide (A3). Login is email + password via Supabase Auth (hashed, never visible to Admin), with rate-limited reset and login, minimum password strength, and optional Admin 2FA later.

---

## 6. Scoring systems (exact formulas)

### 6.1 Health score (retention risk) — no test scores
```
Health = 0.50 x Attendance% + 0.30 x HomeworkCompletion% + 0.20 x FeeTimeliness%
```
- Attendance%: (present + 0.5 x late) / total completed classes x 100.
- HomeworkCompletion%: submitted-or-graded-on-time / total assigned x 100; 100 if none assigned.
- **FeeTimeliness%: paid on/before due OR paid within the 3-day grace = 100; overdue/stopped = 0.** (Changed in v3.1 — the old "in grace = 70" tier is removed, because paying within grace is on-time by policy.)
- Bands: green >= 80, amber 60-79, red < 60. Cold start: < 4 classes = "Not enough data".

> Worked example (the v3.0 "86" case now resolves cleanly): 92% attendance, 88% homework, fee paid within grace (100) → Health = 0.50×92 + 0.30×88 + 0.20×100 = **92.4**, matching the "Paid in full" badge. The health engine and the fee badge must read the same `fee_status` field so they can never disagree.

### 6.2 Academic performance (separate)
Test average, syllabus %, homework grades, and the **CAIE assessed grade vs target grade**. Lives in the Result Slip; the monthly report shows only topics covered, a count of tests conducted, and the assessed-grade **trend**.

### 6.3 Teacher score
```
TeacherScore = 0.45 x Rating% + 0.35 x DemoConversion% + 0.20 x Reliability%
```
- Rating%: rating/5 x 100.
- DemoConversion%: converted / demos-with-recorded-outcome x 100 (excludes pending, prospect no-shows, reassigned). Rolling 90-day window. < 5 completed demos = "Building record".
- Reliability%: on-time starts, low cancellation/leave disruption, class-completion discipline.
- **New teachers start every input at 0 and display "New"** until they have real data (see 2 · New-teacher defaults). A 0 is never shown as a red/bad score for a brand-new teacher.
- (45/35/20 totals 100. Switch to 40/35/25 on request.)

---

## 7. Fees and vouchers

Admin only; Manager blocked at the database on every finance table. A voucher carries the academy header, voucher number, student + parent, fee period, one combined line item with a note of what it covers, total, due date + 3-day grace deadline, payment accounts auto-pulled from Settings, and the reference note ("use the voucher number as your payment reference, then share the screenshot on WhatsApp or upload it in your portal").

Admin reconciles manually and Marks paid; student fee status and health update, and a receipt is issued. Grace-then-review with no late fees. On grace expiry the Admin is notified and given options (Stop / Extend / Mark paid); nothing auto-stops, every choice audited.

**Partial payment (locked):** each part payment is a `payments` row; the voucher shows amount paid vs balance and stays **Due** until fully paid. **Refund (locked):** a negative `payments`/`refunds` row linked to the original voucher, with a reason, audited; the original payment is never edited or deleted.

---

## 8. Notifications and message catalogue

All messages flow through the priority queue. Tone: greeting + a "hope you are well" line, clear purpose, kind close. No slang, no emojis, no dashes. Signed "Thinkerzz". Catalogue (WhatsApp + email each): class reminder, fee due, grace ending (never says "stopped"), demo confirmed, payment received, monthly report ready (tests-conducted count only), defaulter follow-up (warm, relationship-first).

**Merge-field rule (locked):** message templates must never hardcode a gendered pronoun. Use the student's name, and where a pronoun is needed, a `{{pronoun}}` merge field sourced from the student's gender field (he/she/they). (Fixes the hardcoded "she" bug found in the email template.) Full copy in the Message Templates artifact.

---

## 9. Screen inventory

The portal is a role-gated set of screens (all present in the V3 prototype). Each is fully specified in the Developer Guide (Part B).

**Overview:** Dashboard (action center + KPIs + today's classes + teacher availability + funnel + revenue + activity feed; different per role).
**Admissions:** Leads CRM (capture, work, convert; subjects-of-interest is free text at lead stage), Demos (assign teacher **with conflict re-check**, record outcome), Booking Page (public form + config, two locked functions, visual calendar, public link).
**Academy:** Students (table + live health + drawer: Overview/Syllabus/Classes/Fees + Result Slip with CAIE grades), Teachers (table + teacher score + pay Admin-only; add-teacher Admin-only, capacity soft-warning), Schedule (calendar + conflict rule + filters + makeup type), Homework & Tests (completion for health, tests separate, assessed grade).
**Money & Growth:** Finance & Vouchers (Admin only; create voucher, mark paid, partial, refund, grace decision), Reports (funnel, lost reasons, trend, monthly report), Marketing (source performance Google-first, cost/student blank until ads).
**Support:** Tickets (1-hour target), Announcements (audience targeting), **Documents vault** (private bucket, signed URLs), Settings (Admin only; academy rules, weights, payment accounts, booking window, notification priority).

Every screen is documented with: purpose, per-role visibility, on-screen layout, columns/fields, actions & buttons, exact form field lists, computed fields, states & transitions, DB tables, RLS, edge cases, and acceptance criteria.

---

## 10. Interaction and component patterns

Build these once as shared components (all in the prototype): grouped sidebar with per-role visibility and live count badges; top bar with role context and a global "+ Add" quick menu; KPI tiles; the Action Center of click-through cards; data tables with per-row actions and empty states; combine-able filter chips + search; two-column modal forms with validation; a side drawer with inner tabs; bottom-center toasts; confirm dialogs for destructive actions (and for the capacity-override warning); and a "locked" access-restricted panel (enforced at the DB, not just the menu).

---

## 11. Reports catalogue

Parent-facing (printable, brand-consistent): monthly progress report (no raw test scores; tests-conducted count + assessed-grade trend), fee voucher, payment receipt, demo booking confirmation, welcome/enrolment slip, and the Result Slip (where test scores and CAIE grades live).

Internal (staff decisions): Defaulters (in-grace vs overdue, WhatsApp round, nothing auto-stopped), Finance summary (Admin only), Admissions funnel, Marketing (Google-first, cost/student blank until ads), Teacher performance (45/35/20, pay never shown), At-risk students (health < 60, respecting the < 4-classes rule). Working samples of all of these are provided as HTML files.

**Locked report formulas:** Funnel conversion % = (students enrolled ÷ demos booked) × 100 over a chosen date range (default per calendar month, counted by demo booking date). Overdue vs in-grace boundary per the grace rule in section 2.

---

## 12. Recommended build order (7 phases)

1. **Foundation** — Supabase project; all tables with org_id/timestamps/soft-delete/audit; RLS deny-by-default; email/password auth; four roles; `teacher_pay_rates` separate. App on `portal.thinkerzz.com`.
2. **Core records** — Students, Teachers (Admin-only add + capacity), Subjects, **CAIE syllabus templates + topics preloaded and versioned**, `student_subjects` with target/assessed grade.
3. **Admissions** — Leads CRM, Demos (assign + conflict re-check), public Booking page (two locked functions, visual calendar), Convert.
4. **Academics** — Schedule + EXCLUDE conflict rule + per-slot capacity + filters + makeup type, class-completion flow (mobile-first, partial-save safe), Homework, Tests + assessed grade.
5. **Money** — Vouchers, payments, partial, refund, fee cycle + grace-then-Admin-decision, defaulters. Admin only.
6. **Intelligence** — Reports, Marketing, monthly report (LLM, first-name-only, assessed-grade trend), notification queue + priority + failed/retry, cron reminders.
7. **Support & polish** — Tickets, Announcements, Documents vault, Settings, final polish.

Phases 1-2 can start immediately; nothing blocks them.

---

## 13. Risk register and open items

**Bigger items:** notification delivery reality (Calendar needs a Google account, wa.me needs a human click, Resend caps at 100/day — priority queue handles overflow, plan WhatsApp Cloud API for the retention feature); free-tier storage ceilings (where files live, when to move to paid); backups (weekly export from day one).

**Small rules to lock before their phase:** meeting-link method (Google Meet/Zoom, manual/generated); "months committed" meaning and early-exit policy; operational staffing for the 1-hour ticket target across 7 AM-11 PM.

**Now locked (moved out of open items in v3.1):** CAIE target/assessed grade; fee-timeliness within-grace = 100; new-teacher 0/"New" defaults; teacher capacity as a soft warning; Admin-only teacher add + capacity; parent/student one login; 1-hour ticket target framing; partial payment + refund behaviour; Resend priority queue; NULL-teacher conflict re-check at assignment; schedule filters + makeup type; versioned syllabus templates (no AI upload); domain split; pronoun merge field.

**Already locked (from v3.0):** attendance credit (100/50/0), health cold-start (< 4 classes), teacher cold-start (< 5 demos), teacher weights (45/35/20), grace-then-Admin-decision, no late fees, LLM first-name-only, tests separate from the monthly report, Google-first source order, and the security corrections (teacher pay table, cron header secret, soft-delete-aware duplicate checks, time-range booking constraint).

---

## 14. The promise this system makes

Security is the product, not polish. RLS deny-by-default on every table, server-side role checks, private buckets, an append-only audit log, teacher pay in its own protected table, and the public booking page locked to two functions — these are built first and never bypassed. On top of that sits the thing parents feel every month: a clear, warm, accurate report of their child's progress, now including where their child genuinely stands against a Cambridge target. Everything in this plan serves one of those two ends.
