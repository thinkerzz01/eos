# Thinkerzz EOS — Feature Backlog (missing / incomplete)

> Discovery-only list from a full codebase sweep (2026-08-19). Nothing here is a
> security or performance issue — those are handled separately. These are
> **functional gaps**: features that are half-wired, view-only, or absent.
> We are NOT doing these now — this is the parked list to work through later.

---

## ✅ P1 — DONE (implemented 2026-08-21)

All five P1 items are implemented. **Two DB migrations must be run** in the Supabase
SQL Editor for the enrollment write path to work:
- `supabase/migrations/2026-08-21_student_subjects_optional_syllabus.sql` (required
  before any student can be enrolled in a subject — drops the NOT NULL on the
  archived `syllabus_template_id`).
- (No new migration needed for items 2, 3, 5 — student homework RLS + onboarding
  columns already existed.)

1. **Subject-enrollment backbone** — `teacher_subjects` now persisted from the Add
   Teacher form + the Edit Teacher modal (`syncTeacherSubjects` in
   `app/teachers/actions.ts`); reconciles add/remove. `student_subjects` written at
   admission via a per-subject teacher picker in `OnboardStudentModal`
   (`enrollStudentSubjects` + `listEnrollableTeachers` in `app/students/actions.ts`).
2. **Student edit widened** — `updateStudent` + the profile editor now cover email,
   whatsapp, city, address, gender, DOB, exam session, monthly fee, next due date.
3. **Student homework submission** — `submitHomework` action + Submit button in the
   student homework view (marks submitted/late by deadline).
4. **Attendance — full** — (a) `completeClassWithAttendance` is now idempotent
   (upsert, no more duplicate rows) and a completed class's mark can be corrected
   (recorded mark surfaced + prefilled); (b) a dedicated **Attendance Register**
   screen (`/attendance`, sidebar → Academic) marks a whole day at once with a
   per-row Present/Late/Absent, a "Mark all present" bulk, and a teacher/date
   filter, backed by `bulkMarkAttendance` in `app/schedule/actions.ts`.
5. **Onboarding data shown** — `getStudents` now reads DOB + `onboarding_data`; the
   profile Overview has an "Admission & Onboarding" card (school, CNIC, emergency
   contact, exam session, city, address, completion status).

**P1 is now fully complete** (all 5 items). Remaining work is P2/P3 below, plus the
optional "seed more subjects" (only 10 core CAIE subjects exist in the DB, so the
enrollment picker only links those — add Matric/Inter etc. to your curriculum).

---

## 🔴 P1 — original detail (for reference)

### 1. Subject-enrollment backbone has no save path (root cause of several bugs)
The whole "who teaches what / who studies what" layer is collected in forms but
never written to the database, so everything downstream reads empty.
- **Teacher subjects & programs discarded on create** — `AddTeacherModal.tsx`
  collects them; `createTeacher` (`app/teachers/actions.ts`) never writes
  `teacher_subjects`. New teachers show blank subjects/programs forever.
- **Student admission subjects discarded** — `OnboardStudentModal.tsx` collects
  them; `createStudent` (`app/students/actions.ts`) never writes
  `student_subjects`.
- **Cascades:** teacher "current load" always 0, Dashboard "Teacher" filter never
  matches, teacher student-roster (RLS `teacher_read_own_students`) comes up
  empty, per-subject `assessed_grade` can never be set, CapacityWarningModal is
  meaningless.
- **Fix = one clear thread:** write `teacher_subjects` + `student_subjects` from
  the two create forms (and the edit forms).

### 2. Student email (and most fields) uneditable after admission
`updateStudent` (`app/students/actions.ts`) + edit modal only allow name, parent
name, parent phone, program, fee status. **No way to fix a student's email** —
and every calendar invite goes to it, so one typo at admission permanently breaks
invites. Also missing from edit: whatsapp, monthly fee, exam session, next due
date, gender, city, address.

### 3. Student homework submission does not exist
Status enum + UI already show `submitted`/`late`, but `app/homework/actions.ts`
only creates (`assigned`) and grades (`graded`). Students can't submit or upload —
the "Submitted" state is unreachable. Student homework view is read-only.

### 4. Attendance register / bulk marking
Attendance is recorded one student at a time inside "Complete Class"
(`app/schedule/actions.ts`). No register grid, no bulk mark, no per-student
attendance history, and attendance isn't shown per student in Reports.
Also: a wrong mark is permanent — completed classes can't be reopened/corrected.

### 5. Onboarding/Admission data collected but never shown
`submitOnboarding` saves DOB + a JSON blob (school, CNIC, subjects, emergency
contact), but `getStudents` never selects `dob` or the JSON — so DOB shows blank
and the whole onboarding payload has no admin viewer.

---

## ✅ Also done (2026-08-21) — beyond P1

- **Subjects manager** — new `/subjects` screen (sidebar → Academic, admin/manager):
  add / edit / soft-delete subjects, written straight to the DB
  (`app/subjects/actions.ts`). The Add-Teacher and Add-Student enrollment pickers
  now read **live DB subjects** (`listSubjects`) instead of the hardcoded list, so
  what you add here links correctly everywhere. No migration.
- **In-app notification bell (P2 #6)** — DONE. New `app_notifications` table +
  RLS (migration `2026-08-21_app_notifications.sql`), a per-user inbox, and a
  working TopBar bell (unread badge, dropdown, mark-read / mark-all-read). Write
  helpers in `lib/notifications/inapp.ts`; triggers wired: homework assigned,
  homework graded, class rescheduled (→ student), and new demo booking (→ staff).

---

## 🟡 P2 — ✅ ALL DONE (2026-08-21)

- **#1 Global search** — TopBar search is live: debounced `globalSearch`
  (`app/search/actions.ts`) across students/teachers/leads, grouped results
  dropdown, now visible from `md` (was desktop-only). Admin/manager/teacher.
- **#2 CSV exports** — "Export CSV" (current filtered view) on Leads, Receipts
  (payments) and Vouchers, via shared `lib/export/csv.ts`. Students already had it.
- **#3 Marketing ad-spend entry** — "Record Ad Spend" modal on Marketing writes
  `ad_spend` (`app/marketing/actions.ts`), so cost-per-student / ROI now compute.
- **#4 Lead call/notes log** — the lead drawer logs calls/WhatsApp/notes to
  `lead_communications` with history (`listLeadCommunications` /
  `logLeadCommunication` in `app/leads/actions.ts`).
- **#5 Recurring voucher generation** — "Generate This Month" on Vouchers creates
  one voucher per active student not already invoiced for the month
  (`generateMonthlyVouchers`); safe to re-run.
- **#6 In-app notification bell** — DONE earlier (see "Also done" above).

Original P2 detail kept below for reference.

### 6. In-app notifications (bell is decorative) — ✅ DONE
~~`TopBar.tsx` bell has no click/badge/dropdown.~~ Now a real per-user inbox
(`app_notifications` + bell dropdown + triggers).

### 7. Global search is fake
`TopBar.tsx` search input has no handler and a fake ⌘K hint. No command palette /
cross-entity search despite per-page filters.

### 8. Data exports (CSV / PDF)
Only `window.print()` of a single report card exists. No CSV/Excel export on
students, leads, payments, vouchers; no bulk PDF.

### 9. Marketing ad-spend entry
Marketing ROI/CAC/ROAS read `ad_spend` but there's no UI or action to record it
(no `app/marketing/actions.ts`). Metrics compute against zero spend forever.

### 10. Lead communication log
`lead_communications` table exists but there's no "log a call/note" UI; leads have
no communication history.

### 11. Syllabus progress logging
ScheduleClient advertises "log syllabus progress" and reports read it, but no
action writes `syllabus_progress`; templates/topics only exist in seed data.

### 12. Recurring / bulk voucher generation
Nothing auto-creates next month's voucher — every monthly voucher is made by hand
per student. No cron generates vouchers.

### 13. Student portal is thin
Portal home = 4 static tiles. "Next class" is hardcoded empty; no schedule list,
announcements feed, results, or report cards for the student. No voucher/receipt
download or payment-proof upload.

### 14. Teacher portal home surfaces nothing actionable
4 static count-tiles, no lists or links. (Teachers can act on the Homework/Classes
pages, but the home page drills into nothing.)

### 15. Announcement audience ignored
Audience selector (All/Students/Teachers/Parents) is collected but
`createAnnouncement` never writes `announcement_targets`, so per-audience gating
is dead. (Related: read-tracking table exists but nothing marks-as-read.)

### 16. Truncated edits
- **Lead edit** only changes stage + temperature (name/phone/email/program can't
  be corrected).
- **Assessments** have no edit/delete — a mistyped score is stuck. Planned
  "teacher sets CAIE assessed_grade after test" unimplemented.

### 17. Settings fields that look editable but aren't
Tagline, timezone, currency, default target grade, cron secret, Resend cap render
as disabled inputs; only academy name, academic year, grace days, and bank info
actually save.

### 18. Email queue view-only
No retry/cancel/send-now for a permanently-failed email.

---

## 🟢 P3 — partially done (2026-08-21)

**Done:**
- **Refunds source of truth** — the dashboard `refunds` figure now derives from
  the NEGATIVE `payments` rows (the real source), not the always-empty `refunds`
  table (`lib/data/dashboard.ts`).
- **Dead code** — deleted the never-imported `components/teachers/CapacityWarningModal.tsx`.
- **Assessment edit/delete** — a recorded test score can be corrected or deleted
  from the Result Slip (`updateTest` / `deleteTest` in `app/assessments/actions.ts`);
  the test-row id is now carried into each grade.
- **Class notes** — the class-completion modal has a "Class Note" field saved to
  `class_notes` (`saveClassNote` in `app/schedule/actions.ts`); prefilled from the
  saved note.

**Deferred (need more than a cleanup — real sub-features):**
- Teacher payout edit/delete — the payouts screen shows per-teacher aggregates,
  not individual payout rows; needs a payout-history sub-view first.
- Demo edit (student/subject/source) — the demo is modelled off a lead; changing
  those fields is a data-model change, not a field edit.
- Documents upload — needs a Supabase Storage bucket + upload flow.
- Support tickets / referrals — full features, not cleanup.
- Bulk multi-select actions — DONE for Students (2026-08-22): a bulk action bar
  appears on selection with Set fee status / Export / Delete (bulkDeleteStudents +
  bulkSetFeeStatus in app/students/actions.ts). Still could extend to Leads/Vouchers.
- Fabricated per-student metrics (tests%/mastery%) — depend on academic slices
  that aren't built yet.

### Original P3 detail (for reference)

- **Refunds table dead** — `issueRefund` writes negative `payments` rows; the
  dashboard's `refunds` read is always empty. Pick one source of truth.
- **Demo edit** only moves date/time (can't change student/subject/source).
- **Teacher payout** entries can't be edited/deleted.
- **Bulk actions** — no multi-select on students/leads/vouchers (bulk reminder,
  bulk status change).
- **Documents** — no upload/list anywhere; `documents:[]` hardcoded.
- **Referrals** — table exists, no capture/reporting UI.
- **Support tickets** — `tickets`/`ticket_messages` tables exist; support is
  mock-only.
- **Class notes** — `class_notes` table exists, no UI.
- **Fabricated per-student metrics** — tests%/assignments%/mastery%/performance
  score hardcoded 0; aiTag/timeline/tags/mother fields are placeholders.
- **Dead code** — `CapacityWarningModal.tsx` never imported.
- **Unused tables** — `payment_accounts`, `voucher_lines`.

---

### Suggested first thread when we resume
**P1 #1 (subject-enrollment backbone)** — it's the single fix that unblocks the
most: teacher rosters, teacher load/capacity, the dashboard teacher filter, and
per-subject grades all light up once `teacher_subjects` + `student_subjects` get a
write path from the create/edit forms.
