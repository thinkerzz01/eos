# Thinkerzz EOS — Fix Log

A running history of fixes applied during the go-live hardening pass. Newest
entries at the top. Each entry: date/time (PKT), what was broken, what changed.

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

**Still-open deviations (in-scope, NOT yet done — need a decision on effort):**
- fee_status lifecycle isn't advanced by time (due→in_grace) — needs a status
  step in the reminders cron (HIGH). Admin not notified on grace expiry; follow-up
  reminders not queued; monthly-report trend still a placeholder (compute from
  tests). Retry lacks backoff. Voucher missing line-item/reference-note/payment-
  accounts. Finance-write RLS: student can insert negative (refund-looking) payment
  rows — tighten WITH CHECK. anon EXECUTE not restricted to only the 2 booking
  functions (defense-in-depth). Teacher-score (DemoConversion%/Reliability%) not
  computed from real data. Funnel/lost-reason reports + dashboard aggregate tiles
  still placeholders.

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
