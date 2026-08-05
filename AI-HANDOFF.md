# Thinkerzz EOS — System Status & AI Handoff

**Last updated:** 2026-08-04
**Purpose:** A single, honest brief so any AI model (or developer) can pick up this
project without re-discovering everything. Read this first, then `AGENTS.md`
(operating contract) and `Thinkerzz-EOS-Master-Plan-v3.1.md` (policy). The
original independent audit is in `AUDIT-REPORT.md`.

---

## 0. TL;DR

Thinkerzz EOS is a Next.js 14 (App Router) + Supabase academy operating system
(CRM, scheduling, fees, four role portals). An audit found it had started as a
**beautiful UI on hardcoded mock data with bypassable auth**. Since then it has
been turned into a **real, RLS-secured app**: authentication is enforced, 16
screens read live data through Postgres Row-Level Security, the Phase 6
notification/cron backend exists, all dummy data is removed, and the **write
path** has begun (Students, Finance/Vouchers, Leads persist to the database).

**Status (2026-08-04):** the read path (all screens), the Phase 6 backend, the
security completion (server-side role, real signed URLs), and **almost the entire
write path** are now done and the app **builds clean** (`next build` ✓ 24/24).
Persisting writes exist for: students (+CSV import), vouchers/finance, leads
(+convert +inline edit), teachers (+pay rate), demos (+doAssign), announcements,
tickets (+resolve), schedule+attendance, homework (+grade), tests, settings.
Reports is wired to real data.

**Still open (small/deferred):** teacher-payouts "approve" (needs a schema
addition), the documents-vault UI (helper ready), syllabus (reference seed), the
per-role RLS-denial test (procedure below), and ops (seed/admin creation by the
user, cron, deploy).

**Honest completion estimate:** roughly **~80–85% of a shippable product** — the
core is real and secured; what's left is mostly ops/deploy, a couple of deferred
features, and polish.

---

## 1. Tech stack & architecture

- **App:** Next.js 14 App Router, React 18, TypeScript, Tailwind. One codebase,
  four roles (admin / manager / teacher / student), gated by RLS.
- **DB / Auth / Storage:** Supabase (Postgres + RLS + email/password auth +
  private buckets). Schema is in `schema.sql` and `supabase/migrations/`.
  **The schema is applied to the live Supabase project and RLS is enforcing.**
- **Email:** Resend (priority queue, 100/day cap). **AI:** OpenRouter (report
  phrasing only). **Cron:** cPanel Custom cron → secret app endpoints.

### The two patterns every screen follows

**READ (server → client):**
```
app/<screen>/page.tsx        ← Server Component; calls the data layer
  → lib/data/<entity>.ts      ← RLS-enforced Supabase query + DB→UI mapper; fails safe to []
  → app/<screen>/<Screen>Client.tsx  ← 'use client'; receives initial* prop; useEffect syncs on refresh
```

**WRITE (server action):**
```
app/<area>/actions.ts        ← 'use server'; session Supabase client; org_id from the caller's profile;
                               RLS decides permission; audit_log trigger records the write
  → client handler calls the action, then router.refresh()
```

**Rule:** never use the service-role key except in Bearer-guarded cron routes
(`lib/supabase/admin.ts`). Everything user-facing goes through the session client
so RLS applies.

---

## 2. What has been FIXED / IMPLEMENTED ✅

### Authentication (audit finding C2 — closed)
- `middleware.ts` (+ `lib/supabase/middleware.ts`) redirects unauthenticated
  users to `/login`. The old "let everyone through" bypass and the `demo_mode`
  cookie are gone.
- `app/login/page.tsx` is **sign-in only** — removed the "1-click demo" button
  and the silent "auto-create an admin for any email/password" logic.
- Added a real **Sign Out** in `components/layout/TopBar.tsx`.
- `/api/*` routes self-authorize (return JSON), not redirected to login.
- Bootstrap: `supabase/seed_admin.sql` creates the first admin profile.

### Read path — 16 screens on real data (audit finding C1 — largely closed)
Server-rendered from Postgres via RLS: **dashboard (`/`), students, teachers,
leads, demos, schedule, homework, assessments, tickets, announcements,
audit-log, email-queue, fees, vouchers, payments, teacher-payouts.**
Data layers live in `lib/data/*.ts`. `lib/health.ts` implements the locked
health-score formula (fixes audit C7).

### Phase 6 backend — built (audit finding C4 — closed)
- `lib/notifications/` — `templates.ts` (pronoun-safe `{{student_name}}` /
  `{{pronoun}}` merge fields), `enqueue.ts` (idempotent by `unique_key`),
  `resend.ts` (email adapter).
- `lib/reports/monthlyReport.ts` — assembles report facts (no raw scores; count
  of tests + trend), optional LLM phrasing with **first-name + facts only**.
- `app/api/cron/{reminders,send,monthly-reports}/route.ts` — Bearer-guarded;
  `send` drains the queue priority 1→2→3 with the 100/day cap and retries.
- `lib/supabase/admin.ts` — service-role client, cron-only.
- **Verified:** 401 without/with wrong bearer, 200 with the correct token.

### Dummy data removed (clean slate)
- All six `lib/mock*Data.ts` arrays emptied to `[]` (interfaces kept as types).
- `app/DashboardClient.tsx` — all four role views neutralized (fake KPIs, revenue,
  schedule, teacher lists, AI insights, activity → zeros / empty states).
- Dead inline `MOCK_10_TEACHERS` / `MOCK_TEACHER_PAYOUTS` deleted.
- Hardcoded summary cards on teachers / teacher-payouts / students zeroed.
- Database confirmed empty (0 rows; only `audit_log` system rows, which stay).

### Student detail drawer — wired to real data
`app/students/StudentsClient.tsx` — the Academics / Attendance / Finance /
Timeline / Documents tabs now bind to the selected student's real fields with
empty states (replaced ~52k chars of hardcoded samples).

### Write path — STARTED (this is the main ongoing effort)
- **Students:** `app/students/actions.ts` `createStudent` — Onboard Student
  modal persists to the DB.
- **Finance / Vouchers:** `app/vouchers/actions.ts` —
  `createVoucher` (with a Create Voucher modal + student picker),
  `recordPayment` (partial/full), `issueRefund` (negative payment),
  `adminFeeDecision` (Stop / Extend / Mark Paid → audited to `fee_decisions`).
  All keep `students.fee_status` in sync (locked invariant).
- **Leads:** `app/leads/actions.ts` — `createLead` and `convertLead`
  (creates a real student, marks the lead Won, links `converted_student_id`).
- **Teachers:** `app/teachers/actions.ts` `createTeacher` — Admin-only add
  (RLS + role check; new teachers start "New"). The previously-orphan
  `AddTeacherModal` is now wired with an Admin-only "Add Teacher" button.
- **Demos:** `app/demos/actions.ts` — `assignTeacher` (with a **real `doAssign`
  overlap re-check** against the teacher's other demos + class sessions) and
  `recordOutcome`.
- **Announcements:** `app/announcements/actions.ts` `createAnnouncement`.
- **Tickets:** `app/tickets/actions.ts` `replyToTicket` + `resolveTicket`.
- **Schedule:** `app/schedule/actions.ts` — `createClassSession` (one student per
  session; teacher overlap blocked by the DB EXCLUDE constraint) and
  `completeClassWithAttendance`. Needs `supabase/seed_subjects.sql` run first.

### Bug fixes
- Fixed 4 build-blocking TypeScript errors (`next build` now succeeds).
- Fixed a real pattern bug: client screens seeded via `useState(initialX)` ignored
  new props after `router.refresh()`, so writes didn't appear until reload. Added
  `useEffect(() => setX(initialX), [initialX])` sync to the writable screens.

---

## 3. What is STILL BROKEN / NOT DONE ❌  (priority order)

### A. Write path — the biggest remaining chunk
These forms still only update local React state (fake success); they do **not**
persist to the database yet:

| Screen | Missing write |
|---|---|
| **Teachers** | ~~Add teacher~~ ✅ ~~set pay rate~~ ✅ (`app/teachers/actions.ts`; pay column now shows the real rate via an RLS-filtered nested select). Still: subjects/programs not persisted (needs `teacher_subjects`) |
| **Teacher-payouts** | ⚠️ "Approve payout" is NOT wireable — no payouts table/status in the schema (`teacher_pay_rates` is rates only). Needs a schema addition first |
| **Demos** | ~~Assign teacher + `doAssign` re-check + record outcome~~ ✅ DONE (`app/demos/actions.ts`) |
| **Schedule** | ~~Create class + attendance~~ ✅ DONE (`app/schedule/actions.ts`; one-student-per-session model; EXCLUDE constraint handles teacher overlap). Requires `seed_subjects.sql`. FOLLOW-UP: attendance persists but doesn't yet feed health — wire `getStudents` to compute attendance%/homework% from the tables (reuse `monthlyReport.ts` logic) |
| **Tickets** | ~~Reply + Resolve + message count~~ ✅ DONE |
| **Homework / Tests** | ~~Assign + grade homework + record test~~ ✅ DONE (`app/homework/actions.ts`, `app/assessments/actions.ts`). Still: set CAIE assessed_grade on `student_subjects` at test time (needs enrolment) |
| **Leads** | ~~Add + convert + inline edit (stage/temperature)~~ ✅ DONE |
| **Announcements** | ~~Post announcement~~ ✅ DONE (`app/announcements/actions.ts`). Audience targeting not persisted (schema uses program/student, not the audience enum) |
| **Teacher-payouts** | Approve payout |
| **Students** | ~~CSV import → persist~~ ✅ DONE (`bulkCreateStudents`; skips non-CAIE/incomplete rows; defaults exam-session/fee for admin to edit) |
| **Leads** | Inline edit (stage / temperature) — only Add + Convert exist today |

### B. Screens not wired to the DB
- ✅ **Reports** — now real (`lib/data/reports.ts` builds per-student monthly
  reports from attendance + tests). topics/trend/assessed-grade are placeholders
  until syllabus + grade history are wired.
- ✅ **Settings** — save persists the schema-mapped fields (academy name/year →
  `orgs`, grace days → `settings`). Non-schema fields (tagline, currency, cron
  secret, Resend cap) are UI-only.
- **Documents vault** — the signed-URL helper (`lib/storage.ts`) is ready, but
  the vault **UI/screen** is not built.
- **Syllabus** — reads `syllabiSeed.ts` reference data (defensible, but ideally
  from `syllabus_templates` / `syllabus_topics` in the DB).

### C. Security items from the audit
- ✅ **Client role switcher removed (C3 closed).** Role is now derived
  **server-side** from `profiles` in `app/layout.tsx` (`getServerRole`) and passed
  read-only via `RoleContext`. The TopBar "Preview Role" switcher is gone. Users
  see only their real role's UI; RLS remains the actual lock.
- ✅ **Real signed URLs (C5).** `lib/storage.ts` `getSignedDocumentUrl` uses
  Supabase `createSignedUrl`; the fake `generateSignedStorageUrl` was removed.
  (The documents-vault **UI** is still not built — the helper is ready.)
- **`doAssign` overlap re-check** is now implemented for real in
  `app/demos/actions.ts` (demo assignment). The old `checkBookingTeacherConflict`
  helper in `lib/security.ts` is still unused (delete or reuse). Apply the same
  re-check when the Schedule/class teacher-assignment write is built.
- **RLS denial cases not tested** with real manager/teacher/student tokens — only
  the admin path has been exercised.

### D. Ops / deployment (not done)
- cPanel cron not set up yet (endpoints exist; see §5).
- Not deployed to `app.thinkerzz.com`.

### E. Polish (low priority)
- Detail drawers on **other** screens (teacher drawer, ticket detail) may still
  contain sample data — invisible while the DB is empty, but they need wiring.
- Repo cleanup: `dashboard.html`, `thinkerzz-eos-demo-v3.html`, stale `V3/` files.
- Small fonts / accessibility; placeholder `href="#"` links.

---

## 4. LIMITATIONS & GOTCHAS (read before coding)

1. **Academic data is empty by design.** Attendance %, homework %, subjects,
   grades, timeline, and documents come from Phase 4/5 tables that have no rows
   yet. So students and their drawer tabs show **0 / empty states** — this is
   correct, not a bug. They fill in once those tables get data.
2. **Program is CAIE-only.** `students.program` and `leads.program` only allow
   `O Level`, `A Level`, `IGCSE`. The Leads add-form offers "Matric" — a non-CAIE
   value is stored as `null` on a lead and **blocks conversion** to a student.
3. **`leads` table has no `notes` column** — lead notes are not persisted.
   `target_grade` is not persisted at convert (it lives on `student_subjects`,
   created when subjects are assigned).
4. **Role is client-side today** (see §3.C). Do not treat the "Preview Role"
   switcher as security.
5. **NEVER run `next build` while `next dev` is running.** They share `.next`;
   the build corrupts the running dev server (500s with a webpack-runtime error).
   If it happens: stop dev, `rm -rf .next`, `npm run dev` again. Prefer
   `npx tsc --noEmit` to verify types without touching `.next`.
6. **Manager is denied at the DB** on all finance tables, `settings`,
   `audit_log`, `teacher_pay_rates`. Do not try to fetch that data for a manager.
7. **The `Student` / `Lead` / etc. TypeScript types still live in
   `lib/mock*Data.ts`** (data emptied, interfaces kept). Import types from there.
8. **Writes need a seeded admin to test** (see §5). With an empty DB, list
   screens correctly show empty states.

---

## 5. SETUP — do this before working / testing

1. **Env:** `.env.local` already holds `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `OPENROUTER_API_KEY`, `CRON_SECRET_TOKEN`, `ADMIN_EMAIL` (= `admin@thinkerzz.com`).
2. **Schema:** already applied to the live Supabase project (verified). If you
   ever reset the DB, re-run `schema.sql` in the Supabase SQL Editor.
3. **Create the first admin (you must do this — an AI cannot create accounts or
   set passwords):**
   - Supabase Dashboard → Authentication → Users → **Add user**:
     `admin@thinkerzz.com` + a password + tick "Auto Confirm User".
   - Dashboard → Authentication → Providers → Email → turn **off** public sign-ups.
   - SQL Editor → run `supabase/seed_admin.sql` (links the profile, cleans the
     old orphan).
4. **(Optional) sample data:** `supabase/seed_students.sql`, then
   `supabase/seed_voucher.sql` — or just use the in-app **+ New Student** and
   **Create Voucher** buttons (they persist).
5. **Run:** `npm run dev` → http://localhost:3000/login → sign in.
6. **Cron (for reminders/reports), when deploying:** point cPanel Custom cron at,
   every 10–15 min:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://app.thinkerzz.com/api/cron/reminders
   curl -s -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://app.thinkerzz.com/api/cron/send
   ```
   and monthly: `.../api/cron/monthly-reports`.

---

## 6. HOW TO CONTINUE (recommended next steps, in order)

1. **Finish the write path** (biggest lever — turns "shows data" into "runs the
   academy"). Do them in batches using the pattern in §1: **Add Teacher →
   Demos-assign (with `doAssign` re-check) → Schedule/attendance → Tickets →
   Homework/Tests → Announcements → Payouts → CSV import**.
2. **Wire Reports** to the Phase 6 backend, and **Settings** read/write.
3. **Close the security items:** derive role server-side from `profiles` and
   remove the switcher; replace the fake `generateSignedStorageUrl` with real
   Supabase signed URLs; test RLS denial per role.
4. **Deploy** to `app.thinkerzz.com` and wire the cron.
5. **Polish** (§3.E).

### The write-action recipe (copy this for each new form)
```ts
// app/<area>/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function doThing(input: {...}) {
  // 1. validate input against what the schema actually requires (NOT NULL + CHECKs)
  const supabase = createClient();                 // session client → RLS applies
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  // 2. org_id from the caller's profile (multi-tenant scoping)
  const { data: profile } = await supabase.from('profiles')
    .select('org_id').eq('user_id', user.id).is('deleted_at', null).maybeSingle();
  // 3. insert/update — RLS enforces who may write; audit_log trigger records it
  const { error } = await supabase.from('<table>').insert({ org_id: profile.org_id, ... });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/<screen>');
  return { ok: true };
}
```
Then in the client: make the handler `async`, call the action, `router.refresh()`
on success, and ensure the list has `useEffect(() => setX(initialX), [initialX])`.

---

## 7. LOCKED POLICIES — never break these (from `AGENTS.md` / Master Plan)

- **RLS deny-by-default on every table**, scoped by `org_id`. UI gating is
  convenience; the DB is the lock. Never bypass RLS with the service-role key
  outside cron.
- **`teacher_pay_rates` is a separate Admin-only table** — never merge pay into
  `teachers`.
- **Manager denied** at the DB on finance tables, `settings`, `audit_log`,
  `teacher_pay_rates`.
- **Soft delete:** every read filters `deleted_at IS NULL`. Every meaningful
  write appends to `audit_log` (trigger handles it).
- **Time:** store UTC (`timestamptz`), display PKT.
- **Fees:** no late fees. Paying within the **3-day grace = 100** on timeliness.
  Grace expiry never auto-stops — Admin decides (Stop/Extend/Mark paid), audited.
  Partial payment keeps the voucher **Due** with a running balance. Refund = a
  **negative payment** linked to the voucher (never edit/delete the original).
- **Health = 0.50·Attendance + 0.30·Homework + 0.20·FeeTimeliness** (no test
  scores). The health engine and the fee badge both read `students.fee_status`.
- **Teachers:** only Admin adds teachers / sets capacity. Capacity is a **soft
  warning** (confirm + audit the override), not a hard block. New teachers show
  "New", never a red 0.
- **Grades:** CAIE scale (A*..U). `target_grade` defaults A*; `assessed_grade`
  blank until the first test, then teacher-set.
- **Monthly report:** no raw test scores (count of tests + assessed-grade trend
  only). LLM only phrases; receives first name + facts only; never changes a number.
- **Notifications:** nothing sends directly — write to `notifications`; the sender
  drains priority 1→2→3, idempotent by `unique_key`, retries, respects 100/day.
  Templates use `{{pronoun}}` — no hardcoded gendered pronoun.
- **Booking:** teacher session overlap uses the `EXCLUDE` constraint (btree_gist)
  **plus** an application-level re-check at assignment (`doAssign`) for NULL-teacher
  public bookings.
- **Cron secret** goes in the `Authorization: Bearer` header, never the query string.
- **One login serves parent + student.** Four roles: admin / manager / teacher / student.

---

## 8. Key files map

| Area | Files |
|---|---|
| Policy / contract | `AGENTS.md`, `Thinkerzz-EOS-Master-Plan-v3.1.md`, `AUDIT-REPORT.md`, `PROGRESS.md` |
| Schema | `schema.sql`, `supabase/migrations/` |
| Seeds | `supabase/seed_admin.sql`, `seed_students.sql`, `seed_voucher.sql` |
| Auth | `middleware.ts`, `lib/supabase/{client,server,middleware,admin}.ts`, `app/login/page.tsx` |
| Data layers (read) | `lib/data/*.ts`, `lib/health.ts` |
| Write actions | `app/students/actions.ts`, `app/vouchers/actions.ts`, `app/leads/actions.ts` |
| Backend (Phase 6) | `lib/notifications/*`, `lib/reports/monthlyReport.ts`, `app/api/cron/*` |
| Screens | `app/<screen>/page.tsx` (server) + `app/<screen>/<Screen>Client.tsx` (client) |
| Security helpers | `lib/security.ts` (⚠️ `generateSignedStorageUrl` is fake; some helpers unused) |

---

*If you are an AI continuing this work: read `AGENTS.md` fully, confirm the phase
you are in, follow the read/write patterns above, respect the locked policies in
§7, verify with `npx tsc --noEmit` (not `next build` while dev is running), and
update `PROGRESS.md` + this file as you go.*
