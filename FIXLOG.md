# Thinkerzz EOS — Fix Log

A running history of fixes applied during the go-live hardening pass. Newest
entries at the top. Each entry: date/time (PKT), what was broken, what changed.

---

## SETUP & DEPLOY (read this first)

**Important: GitHub does NOT update Supabase.** GitHub stores the code; Supabase is
a separate hosted database. Pushing `schema.sql` to GitHub versions the file but
changes nothing in the live DB. You apply database changes by running SQL in the
**Supabase Dashboard -> SQL Editor** (or via the Supabase CLI) - manually.

**1. Environment variables** (`.env.local`, gitignored - never committed):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `OPENROUTER_API_KEY`, `ADMIN_EMAIL`, `CRON_SECRET_TOKEN`,
`BOOKING_ORG_ID`, bank/wallet vars, and Google:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`.
After changing `.env.local` you MUST restart the dev/prod server (env is read at start).

**2. Apply the database (fresh rebuild):** in Supabase SQL Editor, run in order:
  1. `supabase/reset_database.sql`  (WIPES public data; keeps auth login users)
  2. the whole `schema.sql`         (tables, RLS, functions, realtime, anon lockdown)
  3. Re-seed: your admin SQL for `thinkerzz01@gmail.com`, `supabase/seed_subjects.sql`,
     and (optional) the manager/teacher/student test-role SQL.
  (For an existing DB you don't want to wipe, run only the small migrations noted in
  the batch entries below instead of the reset.)

**3. Google Calendar/Meet:** publish the OAuth consent screen to **"In production"**
so the refresh token doesn't expire in ~7 days. Restart the server after setting the
token. Meet links + calendar invites are created on demo assignment and class
scheduling (best-effort - if Google is off, everything else still works).

**4. Cron (cPanel or similar), each with `Authorization: Bearer $CRON_SECRET_TOKEN`:**
`/api/cron/reminders` + `/api/cron/send` every 10-15 min; `/api/cron/monthly-reports`
at month-end; `/api/cron/backup-export` weekly.

**5. Auth:** turn OFF public sign-ups in Supabase (Authentication -> Providers ->
Email) so accounts are admin-provisioned only.

**6. Public pages** (no login): `/book` (demo booking), `/enroll/<leadId>` (won-student
enrollment). Everything else redirects to `/login`.

---

## 2026-08-09 · Convert lead -> student now records the first month as PAID (B)

`tsc` clean. Fixes the "total paid shows 0" after conversion.
- **convertLead** (`app/leads/actions.ts`) now takes `firstFeePaidDate` +
  `paymentMethod` (was a bare "next due date"). It creates the student, then a PAID
  voucher for the first month + a matching payment, sets `fee_status = 'paid'`, and
  sets the next due date to the paid date + 30 days. Best-effort on the finance rows:
  a manager convert still creates the student (finance is admin-only) and returns a
  warning to add the first voucher manually.
- **Convert modal** (`LeadsClient`): "First Fee Due Date" -> "Date First Fee Paid"
  + a Bank Transfer / JazzCash method, with a note that the first month is recorded
  paid and the next fee is due 30 days later.
- **B1** is covered by this + the onboarding form: convert captures the enrollment
  essentials, the onboarding link collects the fuller details.

---

## 2026-08-09 · Student onboarding form (post-conversion, richer details)

`tsc` clean. After a demo is won and the student is created, the academy now sends
a per-student onboarding link to collect the fuller record and set up portal access.
- **schema.sql** - `students` gains `date_of_birth DATE`, `onboarding_data JSONB`,
  `onboarding_completed_at TIMESTAMPTZ`. New SECURITY DEFINER RPCs (anon-granted):
  `get_student_public(id)` (safe pre-fill of name/program), `submit_onboarding(...)`
  (updates whatsapp/email/city/address/gender/DOB + stores the JSON answers).
- **/onboarding/[studentId]** - public form (school, CNIC/B-Form, subjects, guardian
  occupation/relationship, city/address, emergency contact, notes). Draft field set,
  easy to adjust once the owner confirms exactly what to collect. Added to public
  routes in middleware.
- **Students screen** - row menu gains "Onboarding Form" (admin/manager) that copies
  the `/onboarding/<id>` link to send to the student.

**Run once on the live DB (also in schema.sql):**
```sql
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS onboarding_data JSONB,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
```
Then run the two functions `get_student_public` and `submit_onboarding` from schema.sql.

---

## 2026-08-09 · Testing round fixes - batch 1 (source, payment, voucher date)

`tsc` clean. First batch from the owner's go-live testing pass.
- **A1 Lead source** - `lib/data/leads.ts` forced google/instagram to the label
  "Public Booking", hiding the real source from Leads/Demos (marketing data). Now
  google -> Google, instagram -> Instagram; widened the `Lead.source` type.
- **C2 Payment methods** - vouchers now offer only Bank Transfer + JazzCash
  (removed Cash + Easypaisa) per owner.
- **C1 Voucher paid date** - replaced the free-text "Fee Period" with a "Date Fee
  Paid" date picker; the next due date auto-fills to +30 days (still editable), and
  the period is derived from the paid month.

Remaining from the testing pass (queued): A2 manual-lead full fields, A3 lead
temperature, B1 proper convert/enrollment form, B2 first-month-paid on convert,
C3 voucher preview + WhatsApp send, C4 payment-ledger actions, C5 ledger-vs-voucher
explainer, D1 pay-teacher action, E1 fewer icons, E2 no dashes in report summary,
E3 print-report redesign (needs screenshot), F1-3 finance graphs/forecast/collection,
G1-2 dashboard filters + active-students count.

---

## 2026-08-09 · Booking page: simpler time picker

Verified in-browser (selecting 4 / 30 / PM shows "You chose: 4:30 PM"), no console
errors. The native `<input type="time">` renders differently on every browser/phone
and confused people. Replaced it on `/book` with three plain dropdowns - Hour (1-12)
: Minute (00/15/30/45) AM/PM - the way people read a clock, plus a live "You chose:
4:30 PM" preview. Parts combine into a 24h HH:MM for the backend (unchanged), so
`submitPublicBooking` is untouched. Date + Subject now sit on one row above it.

---

## 2026-08-09 · Password reset (self-service + admin), never retrieval

`tsc` clean; login "Forgot password?" verified rendering with no console errors.
Passwords are one-way hashed and can never be read - so this adds RESET, not
retrieval.
- **Self-service:** "Forgot password?" on `/login` -> `resetPasswordForEmail` ->
  Supabase emails a recovery link that lands on the existing `/set-password` page.
- **Admin/manager reset** on teacher & student rows (`components/account/
  ResetPasswordControl.tsx`): "Send reset email" (Resend recovery link) or
  "Generate temporary password" (random temp set via service-role, shown ONCE to
  relay). Backed by `lib/auth/passwordReset.ts` (targets by teacher_id/student_id,
  resolves the login from `profiles`) and `app/_actions/passwordActions.ts`, which
  enforces: teacher reset = admin only; student reset = admin or manager.
- Gated in UI: student control shows for admin/manager; teacher control for admin.

---

## 2026-08-09 · Fix: every non-admin login landed on the student portal

`tsc` clean. **Bug:** `getServerRole()` (app/layout.tsx) resolved the signed-in
user's role with a plain `from('profiles').select('role')`, which is subject to
RLS - and there was NO policy letting a non-admin read their own profile row. So
the query returned nothing for teacher/manager/student and the code fell back to
'student', sending everyone to the student portal. The same gap blocked a manager
from reading their org_id when creating students.

**Fix (two parts):**
- `app/layout.tsx` - resolve role via the `current_user_role()` SECURITY DEFINER
  RPC instead of a plain RLS-gated select. Works without any per-role read policy.
- `schema.sql` - add `own_profile_read` policy: `FOR SELECT USING (user_id =
  auth.uid())` so any signed-in user can read their OWN profile (needed for
  manager org_id lookups and any other direct profile reads). Restricted to the
  user's own row - reads no one else's.

**Run once on the live DB (also in schema.sql now):**
```sql
DROP POLICY IF EXISTS own_profile_read ON public.profiles;
CREATE POLICY own_profile_read ON public.profiles FOR SELECT USING (user_id = auth.uid());
```

---

## 2026-08-09 · Fee vouchers now show where to pay

`tsc` clean. The `BANK_NAME_TITLE` / `BANK_ACCOUNT_NO` / `BANK_ACCOUNT_IBAN` /
`MOBILE_WALLET_INFO` env vars existed but nothing read them, so a student's voucher
never showed the academy's bank/JazzCash details. Added `lib/config/paymentInfo.ts`
(server-only reader; returns null if none set) and a "How to pay your fee" panel on
the student Fees screen (`app/fees`). Hidden automatically when the vars are unset.

---

## 2026-08-09 · Auto-provision teacher & student portal logins

`tsc` clean. `/set-password` page verified rendering (shows "invalid link" with no
token; real invite links carry the session in the URL hash and show the form).

**Problem:** adding a teacher / enrolling a student created only the DATA row, not a
LOGIN. A person can only sign in if they have (1) a Supabase Auth account and (2) a
`profiles` row linking it to a role (+ teacher_id/student_id). Nothing in the app
created those, so only manually-seeded users (admin) could log in - teachers and
students had no portal access.

**Fix:** on teacher creation, student enrollment (`/enroll`), and admin student
onboarding, the app now auto-provisions the login:
- `lib/auth/provision.ts` (`provisionLogin`, server-only, service-role): creates/finds
  the Auth user via `admin.auth.admin.generateLink` (invite, or recovery if the email
  already exists), upserts the `profiles` row with the right role + teacher/student id,
  and emails a single-use set-password link via Resend. Best-effort: a mail/quota
  failure never undoes the core write (returns a `warning` the modals surface).
- `app/set-password/page.tsx` - where the invited person lands; the browser client
  exchanges the URL-hash tokens into a session, they set a password, then enter the
  portal. Added to public routes in `lib/supabase/middleware.ts`.
- Wired into `app/teachers/actions.ts` (createTeacher), `app/enroll/[leadId]/actions.ts`
  (captures the student id returned by `submit_enrollment`), and
  `app/students/actions.ts` (createStudent). Modals show a warning toast if the invite
  email could not send.

**Required config for the emails to actually deliver:**
1. `.env.local`: add `NEXT_PUBLIC_SITE_URL` = the real site URL (e.g.
   `https://portal.thinkerzz.com`; `http://localhost:3000` in dev). The set-password link
   redirects here.
2. Supabase -> Authentication -> URL Configuration: add `<SITE_URL>/set-password` to
   the allowed **Redirect URLs** (and set Site URL). Otherwise the link is rejected.
3. Resend: verify a sending domain and set `RESEND_FROM` to an address on it. The
   default `onboarding@resend.dev` only delivers to the Resend account owner, so real
   students/teachers won't receive mail until a domain is verified.

---

## 2026-08-08 · Build batch: enrollment form + admin delete (5 & 6)

`tsc` clean. Completes the owner's 6-item list.
- **Won demo -> enrollment form (#5)** - new public page `app/enroll/[leadId]` +
  `submit_enrollment` SECURITY DEFINER function (schema.sql, anon-granted) that
  creates the student from the won lead and marks it converted (fee stays 0; admin
  sets fee + schedule after). Added `students.first_class_date`. Marking a demo
  "Won" now pops a copyable enrollment link (replacing the separate Convert step).
  `/enroll` added to the public routes in middleware.
- **Admin delete actions (#6)** - `softDeleteLead` + `deleteDemo` server actions;
  admin-only Delete buttons on the Booking & Schedule rows and the lead drawer.

---

## 2026-08-08 · Build batch: booking, times, realtime, Google Meet

`tsc` clean. (Used plain `fetch` for Google - no new npm dependency.)
- **Booking page** (/book): replaced fixed hourly slots with a real **time picker**
  (any time, clickable AM/PM), added a **Subject** dropdown and a **"How did you
  find us?"** field that becomes the lead's real source. `create_public_booking`
  now takes `p_source` (schema.sql, defaulted so nothing breaks).
- **Human-readable times** on Booking & Schedule (e.g. "Mon, 11 Aug, 4:30 PM").
- **Realtime auto-refresh** - DemosClient subscribes to demos/leads inserts and
  refreshes automatically; schema.sql adds those tables to the realtime publication.
- **Google Meet + Calendar** - `lib/google/calendar.ts` (OAuth refresh-token ->
  access token -> Calendar API, best-effort). Demo **assignment** creates a one-off
  Meet + invites student & teacher; **class scheduling** creates one recurring Meet
  series per subject and shares its link across the generated sessions. `meeting_link`
  + `calendar_event_id` stored. Guests join-only (can't invite/modify). Fails safe
  if Google is unset/token lapses.

Still to build (owner's list): **#5 Won-demo -> enrollment form** (new public page +
SECURITY DEFINER submit function + `students.first_class_date`), **#6 admin full
add/delete/actions** across screens.

---

## 2026-08-08 · Program list widened to the 7-set (Matric/Inter now allowed)

Owner confirmed the canonical programs: O Level, A Level, IGCSE, Matric (9th),
Matric (10th), Inter (11th), Inter (12th). Matric/Inter were being rejected by the
DB CHECK (CAIE-only), which is why they weren't selectable. Widened everywhere:
- schema.sql program CHECK constraints widened to the 7-set.
- Validation lists in app/students/actions.ts, app/leads/actions.ts,
  app/book/actions.ts renamed CAIE_PROGRAMS -> ENROLLABLE_PROGRAMS (the 7).
- Program dropdowns now map ALL_PROGRAMS (the 7): OnboardStudentModal, LeadsClient
  add-lead, StudentsClient edit, and the public /book page.
`tsc` clean.

**Live-DB migration (run once):**
```sql
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_program_check;
ALTER TABLE public.students ADD CONSTRAINT students_program_check
  CHECK (program IN ('O Level','A Level','IGCSE','Matric (9th)','Matric (10th)','Inter (11th)','Inter (12th)'));
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_program_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_program_check
  CHECK (program IN ('O Level','A Level','IGCSE','Matric (9th)','Matric (10th)','Inter (11th)','Inter (12th)') OR program IS NULL);
```

---

## 2026-08-08 · Schedule modal → "set up a student's timetable" wizard

Rebuilt the Schedule-a-class modal per owner spec. `tsc` clean.
- **Bigger modal + larger fonts** (max-w-3xl, text-sm base).
- **Student filter tabs**: New (no classes yet) vs Already-scheduled (derived from
  existing class_sessions).
- Student's **program auto-detected**; the subject dropdowns are filtered to it.
- **Multiple subject rows** — each with its own **teacher**, **weekdays**
  (default Mon–Fri; Sat/Sun off unless ticked), and **start/end time**.
- **Auto-generates ~1 month** (choose 1wk / 2wk / 1mo / 2mo) of class_sessions on
  the selected weekdays from a start date. New `bulkScheduleClasses` action;
  teacher time conflicts are skipped (EXCLUDE 23P01) and reported as a count.
- **Class types explained inline**: Regular = normal class · Makeup = free
  replacement for a missed class · Test = assessment session.
- `app/schedule/page.tsx` now passes `program`; `bulkScheduleClasses` added to
  `app/schedule/actions.ts`.
- NOTE: the empty Subject dropdown was NOT a bug — the `subjects` table is unseeded.
  **Run `supabase/seed_subjects.sql`** and subjects appear (filtered by program).

---

## 2026-08-08 · Last two items: dashboard tiles + admin grace alert

- **Dashboard aggregate tiles wired** (§9) — new `lib/data/dashboard.ts`
  `getDashboardMetrics()` (fail-safe) feeds the admin view: Active Teachers,
  Classes Today (+ today's schedule list), Revenue this month, Demos-need-teacher,
  Tickets-urgent, Fee Collection %, Teacher Capacity list (load/capacity bars), and
  the Financial Snapshot (Collected / Outstanding / Refunds). `app/page.tsx` now
  fetches metrics alongside students.
- **Admin "grace expired" notification** (§7) — new `grace_expired_admin`
  notification type + Admin-facing template; the reminders cron enqueues one alert
  per voucher to the org's admin when a grace period ends unpaid.

**Extra DB migration for the admin alert (run on live DB):**
```sql
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('class_reminder','fee_due','grace_ending','demo_confirmed','payment_received','monthly_report','follow_up','announcement','grace_expired_admin'));
```

`tsc` clean. Both previously-remaining items are now done.

---

## 2026-08-08 · Syllabus feature removed (archived locally)

Owner request: "remove Syllabus from system but save in my local to use in future."
- **Archived** to `_archive/syllabus/` (gitignored + excluded from tsconfig, so it
  stays local only): `page.tsx` (the screen), `syllabusData.ts` (the removed master
  data), `StudentDrawer.tsx` (an orphan component that used it), and a `README.md`
  with restore steps.
- **Removed from the app:** the `/syllabus` route, the "Subjects" sidebar nav item,
  the orphan `components/students/StudentDrawer.tsx`, and the syllabus exports
  (`MASTER_SYLLABI`, `CAIE_MASTER_SYLLABI`, `getSyllabusTemplate`,
  `SyllabusTemplate`, `SyllabusTopic`) from `lib/syllabiSeed.ts`. The shared
  exports there (`ALL_PROGRAMS`, `CAIE_PROGRAMS`, `ALL_SUBJECTS`, `EXAM_SESSIONS`,
  `LEAD_SOURCES`, `LOCAL_BOARD_PROGRAMS`) were **kept** — other screens use them.
- `tsc` clean.

---

## 2026-08-08 · Batch 8: spec build-out ("remove Documents vault, fix rest")

Removed the Documents vault and built/fixed the remaining spec deviations. `tsc`
clean throughout (dev server left running — verify with tsc, not `next build`).

- **Documents vault removed** — the student-drawer Documents tab + its type/content
  and the unused `lib/storage.ts` signed-URL helper are gone.
- **anon EXECUTE lockdown** (§3.3) — done the SAFE way: `REVOKE EXECUTE … FROM
  PUBLIC` then re-`GRANT` to authenticated + service_role, so RLS helper functions
  keep working and anon is left with only the two booking functions. (schema.sql)
- **Teacher score** (§6.3) — DemoConversion% now computed from the real demos table
  over a rolling 90-day window (only demos with a recorded outcome; cold-start < 5),
  not stale stored counts. (lib/data/teachers.ts)
- **Retry backoff** (§3.5) — added `next_retry_at`; the sender now backs off
  exponentially (1,2,4,8,16 min) and skips rows that aren't yet re-eligible.
  (schema.sql + app/api/cron/send/route.ts)
- **Weekly backup-export cron** (§3.3) — new bearer-auth route dumps core tables to
  a downloadable JSON. (app/api/cron/backup-export/route.ts)
- **Marketing screen** (§9/§11) — new route + data layer: source performance
  (Google first) from leads.source, conversion, ad spend, cost/student (blank until
  ads). Added to the Admissions nav (admin/manager). (app/marketing/*, lib/data/marketing.ts)
- **Funnel + lost-reason reports** (§11) — enrolled/demos-booked funnel % and a
  lost-reason breakdown added to the Reports screen. (lib/data/reports.ts + ReportsClient)

**DB SQL to run on the live database (accumulated — safe to run together):**
```sql
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NULL;

DROP POLICY IF EXISTS student_insert_own_payments ON public.payments;
CREATE POLICY student_insert_own_payments ON public.payments FOR INSERT WITH CHECK (
  current_user_role() = 'student' AND amount > 0 AND voucher_id IN (SELECT id FROM public.vouchers WHERE student_id = current_student_id() AND deleted_at IS NULL));

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- teacher/student read of subjects + teachers (from Batch 6, if not already run)
CREATE POLICY teacher_read_subjects ON public.subjects FOR SELECT USING (current_user_role() = 'teacher' AND org_id = current_user_org_id());
CREATE POLICY student_read_subjects ON public.subjects FOR SELECT USING (current_user_role() = 'student' AND org_id = current_user_org_id());
CREATE POLICY teacher_read_teachers ON public.teachers FOR SELECT USING (current_user_role() = 'teacher' AND org_id = current_user_org_id());
CREATE POLICY student_read_teachers ON public.teachers FOR SELECT USING (current_user_role() = 'student' AND org_id = current_user_org_id());
```

**Still remaining (need a dedicated careful pass — NOT done):**
- **Dashboard aggregate tiles** (§9) — today's classes / revenue / teacher
  availability / activity feed still placeholders. Deferred on purpose: it's a
  500-line 4-role component you're actively testing; wiring it deserves its own
  pass, not a rushed blind edit.
- **Syllabus DB-wiring** (§12 P2) — screen reads `lib/syllabiSeed` constants
  (defensible reference data; displays correctly). Needs a seed + data layer to be
  DB-versioned.
- **Admin grace notification** (§7) — needs a new `notifications.type` (CHECK
  migration) + template; admin still sees the on-screen decision card.

---

## 2026-08-07 · ~23:27 PKT — Batch 7: requirements-compliance audit (Master Plan v3.1)

Ran a 6-area compliance audit against `Thinkerzz-EOS-Master-Plan-v3.1.md` +
`AGENTS.md` (security invariants, exact scoring formulas, fees/grace, roles matrix,
notifications/reports, screens/data-model/phases). **60 requirements checked → 35
compliant, 25 deviations.**

**Fixed this batch (clear in-scope violations — no new modules):**
- **Grace boundary off-by-one** (§2) — "Fees need a decision" fired ON the
  grace-deadline day (one day early). Now compares PKT calendar dates so the
  deadline day is still grace; overdue begins the day after. (lib/data/vouchers.ts)
- **Report privacy over-disclosure** (§6.2 — report shows trend only, not the
  letter) — removed the assessed-grade letter from the parent-facing draft body
  and the report card badge; both now show the up/same/down **trend** only.
  (app/reports/ReportsClient.tsx)
- **Monthly report over-counted** (§11 — this-month facts) — the report's test
  count was lifetime; now scoped to the current month. (lib/data/reports.ts)
- **Announcements create control** (§5 — Announcements create = Admin + Manager) —
  "+ New Announcement" button/modal now gated to admin/manager (read stays open to
  all). (app/announcements/AnnouncementsClient.tsx)
- **fee_status lifecycle by time** (§2/§6.1) — the reminders cron now flips an
  unpaid voucher due→in_grace inside the grace window and mirrors
  students.fee_status, so the health engine + fee badge stop drifting.
  (app/api/cron/reminders/route.ts)
- **Follow-up reminders** (§3.3) — the cron now enqueues lead follow-ups due today
  (the `follow_up` template already existed). (app/api/cron/reminders/route.ts)
- **Monthly-report grade trend** (§6.2) — was hardcoded 'same'; now computed from
  real test scores, this month vs last (up/same/down). (lib/reports/monthlyReport.ts)
- **Finance-write RLS** (§3.3/§4) — the student payment-insert policy now requires
  `amount > 0`, blocking negative refund-looking rows. (schema.sql — **run on live DB**)

**Still-open (deferred with reason — NOT silently skipped):**
- **Admin grace notification** (§7) — deferred: needs a NEW notification template
  type (an add); the admin still sees the on-screen decision card meanwhile.
- **Retry backoff** (§3.5) — deferred: needs a new `next_retry_at` column (DB
  migration) + send-route logic.
- **anon EXECUTE lockdown** (§3.3) — deferred ON PURPOSE: the naive
  `REVOKE EXECUTE … FROM PUBLIC` would strip authenticated users' EXECUTE on the
  RLS helper functions (current_user_role() etc.) and break the whole app.
  Exploitability today is nil (anon's auth.uid() is NULL). Needs a careful
  per-function revoke, not a blanket one.

**Feature-builds (net-new work — awaiting go-ahead, since they add features):**
- Voucher line-item + reference-note + payment-accounts on the voucher.
- Teacher-score engine (DemoConversion% 90-day window / Reliability%).
- Funnel + lost-reason reports; dashboard aggregate tiles (today's classes,
  revenue, teacher availability, funnel, activity feed) wired to real tables.

**OUT-OF-SCOPE additions (spec-required modules that are ABSENT — flagged, NOT
built, since building them adds features):**
- **Marketing screen** (§9/§11) — no route/UI (ad_spend + leads.source exist).
- **Documents vault screen** (§9 Phase 7) — backend + signed-URL helper ready, no UI.
- **Weekly backup-export cron** (§3.3) — endpoint absent.
- **Syllabus DB-wiring** (§12 Phase 2) — screen reads code constants; not seeded
  into syllabus_templates/topics (defensible as reference data, but spec wants it
  versioned in the DB).

`tsc` to be re-verified after the batch; dev server left running (no `next build`).

---

## 2026-08-07 · ~23:10 PKT — Batch 6: functional bug sweep (16 verified bugs)

A 4-dimension parallel sweep (auth/role, write-actions, data-reads, UI-wiring),
each finding adversarially verified, surfaced 16 real bugs. All fixed (no new
features — corrected logic, gated by existing role, removed unstorable options):

Data-correctness:
- **Reports** hardcoded a "B" grade for every student → now derived from real test
  scores (`—` when no tests). (lib/data/reports.ts)
- **Demo "No-show"** outcome displayed as "Pending" after refresh → mapper fixed. (lib/data/demos.ts)
- **Teacher Payouts** duplicated a teacher when their pay rate had history → dedupe
  to the latest rate per teacher. (lib/data/teacherPayouts.ts)

Data-integrity / validation:
- **Schedule** "Complete Class" on an already-Completed session re-inserted
  duplicate attendance → guarded (handler early-return + button hidden when done).
- **CSV bulk import** aborted entirely when 2 rows lacked a phone ('N/A' unique
  collision) → phone-less rows are now skipped (counted), not force-inserted.
- **createLead** didn't validate phone (2nd phone-less lead threw a duplicate-key
  error) → phone now required.
- **Onboard Student** & **Add Lead** offered non-CAIE programs the DB rejects →
  restricted to CAIE. Lead "Demo Done" stage couldn't persist (reverted to "Demo
  Set") → removed as a separate stage/tab. Lead-source "WhatsApp Inquiry"/"Booking
  Page" silently saved as "google" → relabeled to normalize correctly.

Role-access:
- **Quick Action** menu (create actions) was shown to every role → admin/manager only.
- **Homework** "+ Assign" and **Schedule** "+ Schedule Class" / "Complete Class"
  write controls were shown to students → gated behind role.
- **Students/parents couldn't reach their own fee vouchers** (/fees missing from
  nav) → added a student-scoped "My Fee Vouchers" nav item.

Database (RLS) — needs to be applied to the live DB:
- **subjects** & **teachers** had no teacher/student SELECT policy → teacher/student
  portals showed blank Subject and "Unassigned" teacher. Added in-org read policies
  to schema.sql (pay stays isolated in teacher_pay_rates). **Run on live DB.**

`tsc` clean. (Build verified via tsc only — dev server left running for testing.)

---

## 2026-08-07 · ~22:40 PKT — Batch 5: role-based access + nav honesty

Audited the role/login path (middleware → server `getServerRole` from `profiles`
→ `RoleProvider` → `PortalLayout`/`Sidebar` gating). Auth foundation is sound
(`profiles.role` CHECK matches the app roles; RLS uses `current_user_role()`).
Fixed real issues:
- **Role-gate holes** — 6 screens had `allowedRoles` set to all 4 roles while the
  Sidebar intends them restricted, so a teacher/student could URL-hop into the
  wrong UI. Tightened to match intent: Students → admin/manager/teacher; Teachers,
  Leads, Demos, Reports, Email-queue → admin/manager. (RLS already blocked the
  data; this closes the UI hole too.) Aligned the Sidebar so Announcements shows
  for all signed-in roles (matches the page).
- **Fake TopBar identity** — the greeting hardcoded "Sir Kamran Ali" (teacher) /
  "Ahmed Raza" (student); now shows the real role label. Removed the fake "12"
  notification badge.
- **Fake Sidebar badges** — hardcoded Leads=5, Tickets=4, Email=8 counts (never
  wired) removed.
- **Dead Quick-Action menu** — only "New Student" was wired; the other 8 items did
  nothing. Each now navigates to its real screen (New Lead → /leads, etc.).

Build re-verified: `tsc` clean, `next build` green.

---

## 2026-08-07 · ~22:15 PKT — Batch 4: readability / type-size floor

Addressed the audit's typography note (AGENTS §4.1 — "almost everything is
`text-xs` / `text-[11px]` / `text-[10.5px]`; too small"). Established a **12px
minimum**: every custom sub-12px size — `text-[9.5px]`, `text-[10px]`,
`text-[10.5px]`, `text-[11px]`, `text-[11.5px]` (~205 uses across 20 files) — was
bumped up to `text-xs` (12px). The 454 existing `text-xs` body/table sizes were
deliberately left as-is so the dense data tables and filter bars don't reflow.
Purely a className change (no logic touched); `next build` re-verified green.
Can be taken further to a `text-sm` (14px) body minimum on request.

---

## 2026-08-07 · ~22:00 PKT — Batch 3: remaining front-end honesty fixes

A 4-way parallel audit found 29 remaining hardcoded/fabricated front-end values
and inert (non-functional) filter dropdowns. Every fix here either binds to data
ALREADY in scope or neutralizes/removes the fake — nothing new was added.

**Student profile drawer (StudentsClient)** — all bound to the real student now:
- Status row was always "Active" in green → binds to `status` (correct label + color).
- Performance gauge ring was always green → color derived from `performanceScore`.
- "⭐ Excellent" badge → shows the real `aiTag`.
- Score-band legend "93% / 5% / 2% / 0%" (cohort numbers with no source) → removed.
- Hardcoded "High Performer / Excellent Attendance / Homework On Time" chips → map real `tags`.
- Next-class "SK" avatar → initials of the real `nextClassTeacher`; "(in 45 min)"
  and the room "🟢 live" dot → removed (no data); "This Month ˅" fake period selector → removed.
- Fee-status pill was always green → color derived from `feeStatus`.

**Teacher drawer (TeachersClient)** — "🟢 Active" badge → real `status` (+color);
5-star glyphs → derived from real `rating`; unsupported "⭐ Verified Rating" badge → removed.

**Filter dropdowns now populate from real data (were hardcoded/inert):** students
(program / subject / teacher), dashboard (program / teacher / subject), teachers
(subject), leads (program), schedule (subject). The schedule Today/This-Week/This-Month
tabs and the leads/teachers "Page 1 of 1" pagination did nothing → removed. Teachers'
"On Leave" tab count → computed. Leads convert modal's discarded "Target Grade" select
→ static locked-policy display. Fees screen's non-functional filter chips → removed.
Syllabus "Version: 2026" → bound to `template.academicYear`.

Build verified: `tsc --noEmit` clean; `next build` green (24/24). No remaining
fabricated literals (grep-verified).

---

## 2026-08-07 · ~21:30 PKT — Batch 2: fake data & non-persisting saves

A per-screen audit found buttons that "saved" only to local state, fabricated
figures shown as real, and decorative buttons with no handler. Fixed:

**Blockers**
- **Teacher-payouts** — removed the fake *"payout processed successfully!"* alert
  and the local status flip. Summary cards now compute from the real rows. Dead
  icon imports removed. Added an honest note that bank-transfer dispatch needs a
  `payouts` table (not in the schema yet), instead of pretending it works.
- **Email-queue** — removed the "Drain Queue Now (Cron Simulation)" fake and its
  fabricated success alert (draining is the cron's job). The metrics banner now
  derives from the real queue; added a "Refresh Queue" button.
- **Assessments** — the "official Result Slip" no longer shows a hardcoded
  80.0% / A* / A*. Internal Average and Assessed Grade are computed from the real
  grades; Target Grade shows "—" (not tracked); marks show out of real totalMarks.
- **Students** — "Save Changes" and "Delete Student" now persist via new
  `updateStudent` / `softDeleteStudent` server actions (RLS-enforced) + refresh.
  CSV import no longer stamps fake defaults (Sara Khan / PKR 45,000 / 85%);
  missing cells stay blank/zero. Performance score is read-only (derived);
  program list trimmed to CAIE (matches the DB CHECK).

**Should-fix**
- **Announcements** — removed the audience selector (it was never saved — the
  schema has no audience enum); feed badge now truthfully reads "All Academy".
- **Settings** — only the persisted fields (name, academic year, grace days) stay
  editable; tagline / target grade / Resend cap are marked reference-only; the
  hardcoded sample **cron secret** is gone (shown as env-managed, never stored).
- **Reports** — "Print Report" now actually prints; the fake "Enqueue Dispatch"
  button was replaced with a note that the month-end cron sends reports.
- **Teachers** — the four KPI cards (active / at-capacity / avg load / avg pay)
  now compute from the real list; the "Sir Bilal at 100%" fake AI insights were
  replaced with a real staff summary.
- **Students** — hardcoded KPI sub-labels ("60% of current", "PKR 390,000") and
  fake AI-insight text replaced with honest/derived values. Quick-Action buttons
  now navigate to their screens; the dead "Quick Add" button was removed and the
  misleading "Reassign Teacher" menu item relabeled "View Profile".
- **Tickets** — the conversation thread now renders the real reply history (the
  data layer returns message bodies, not just a count).

Build verified: `tsc --noEmit` clean throughout; `next build` green.

**Still open (cosmetic, only visible once rows exist):** the student profile
drawer still has a few static display fields (status badge, score distribution,
next-class line); some filter dropdowns use fixed option lists; the teacher
drawer status/rating badges are static.

---

## 2026-08-07 · ~19:00 PKT — Batch 1: go-live blockers

Re-audited the live code (build verified: `tsc` + `next build` both clean, 24/24
routes). Fixed the six "looks-done-but-fake" items:

1. **Public booking `/book` was cosmetic** — slot list read an empty mock array
   and "submit" generated a random ref client-side with no DB write (every
   booking silently dropped). Now wired: new `app/book/actions.ts`
   `submitPublicBooking` calls the `create_public_booking` SECURITY DEFINER
   routine (anon-safe) → creates a real lead + unassigned demo. Page rewritten
   with a real date picker + PKT time-slot grid, real submit, error states, and a
   real reference code. Added `BOOKING_ORG_ID` to `.env.local`.
2. **Reports "Re-phrase with AI" button was fake** — `setTimeout` + fabricated
   string, never called the LLM. Replaced with a deterministic "Generate Report
   Draft" built from the student's real numbers, with an honest note that warm
   LLM phrasing runs in the month-end cron. Fixed hardcoded "July 2026" month.
3. **Misleading "RLS DENY ENGINE" message** in `PortalLayout.tsx` claimed a DB
   SELECT was denied when it was only a client-side role gate — reworded honestly.
4. **Dead/misleading code in `lib/security.ts`** — removed three unused helpers
   (incl. the fake denial-string generators); kept only `verifyCronBearerHeader`
   (the one function actually used, by the cron routes).
5. **`PROGRESS.md` was stale** — still headlined "100% shipped"; rewritten to the
   true state + an operator go-live checklist.
6. **Repo cruft** — removed tracked prototype files `dashboard.html` and
   `thinkerzz-eos-demo-v3.html`.
