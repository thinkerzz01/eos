# Thinkerzz EOS - Syllabus Module (Complete Plan)

Status: PLANNING (no code written yet)
Model: one-on-one tuition
Scope decided: coverage tracking, admin-entered outlines, text only (no PDFs)
Last updated: 2026-09-17

---

## 1. What we are building (and what we are not)

**Goal:** For each student's enrolled subject, track how much of the official Cambridge/Edexcel
syllabus has been covered, at the subtopic level. Teachers mark coverage; students view their own
progress; admin maintains the outlines.

**In scope**
- Admin builds/edits syllabus outlines (topics -> subtopics) per subject, as plain text.
- Teacher marks subtopics covered for their assigned student(s).
- Progress: cumulative % covered + weekly pace ("on track / behind").
- Student portal: read-only view of THEIR subject(s) and their own progress.

**Explicitly NOT in scope (per owner)**
- No PDF ingestion, no document upload, no scraping Cambridge.
- No mastery / grade-to-topic mapping (coverage != learned; see Risk R5).
- No student actions (view only).
- No group/class model (this is one-on-one).

---

## 2. Decisions - locked vs still open

### Locked
- One-on-one model. Coverage is **per student**, not per class/group.
- Roles: admin edits outlines; teacher marks; student views only, own subjects only.
- AS and A2 are separate (already separate rows in `subjects`), so each gets its own outline.
- Text only. A dedicated Syllabus tab/screen is fine.

### OPEN - these change the schema, must be settled before Phase 1
| # | Decision | Options | My recommendation | Why it matters |
|---|---|---|---|---|
| D1 | Outline lifetime | (a) current-only, edit in place  vs  (b) snapshot per enrollment | **(b) snapshot** | A-Level spans 2 years; editing the live outline re-measures existing students against topics that did not exist when taught. Their % silently goes wrong mid-course. Snapshot pins each student to the outline as it was on enrollment. This is NOT "keeping all old versions" - it is not corrupting a live student's record. |
| D2 | Where teachers mark | (a) standalone Syllabus tab  vs  (b) tied to the class session they just taught | **(b) tied to session** | Lower friction = higher adoption. Auto-captures the date, so weekly-pace is honest and free. A standalone tab gets forgotten. |
| D3 | Entry method | (a) manual typing  vs  (b) paste-parser (paste contents section, auto-split) | **research first, likely (b)** | Volume is large (see section 8). A parser turns hours into minutes, but must be tested against real Cambridge PDF formatting before we commit. |
| D4 | Which subjects first | all offered  vs  only currently-active 1-on-1 subjects | **only active ones** | Do not enter 2,000+ lines for subjects you are not teaching. Need the real active list. |

The plan below is written for the **recommended path (D1=b, D2=b)**. If you overrule D1/D2, sections 4 and 6 change.

---

## 3. Roles & permissions

| Action | Admin | Teacher | Student |
|---|---|---|---|
| Create/edit/reorder/remove syllabus outline | Yes | No | No |
| Mark a subtopic covered / uncovered | No* | Yes (own students) | No |
| View outline + progress | Yes (all) | Yes (own students) | View own subjects only, read-only |

*Admin marking can be enabled if you want; default off to keep responsibility with the teacher.

RLS: all tables `org_id`-scoped. Teacher writes limited to students assigned to them.
Student reads limited to their own enrollments.

---

## 4. Data model

Anchored to the existing `subjects` table (AS Physics 9702, IGCSE Physics 0625, ... are separate rows).

### 4.1 Master outline (what admin edits)
```
syllabus_topics
  id            uuid pk
  org_id        uuid
  subject_id    uuid  -> subjects.id      (the exact AS/A2/IGCSE row)
  code          text  ("1", "2", ...)     nullable
  title         text  ("Physical quantities and units")
  sort_order    int
  deleted_at    timestamptz               (soft delete)

syllabus_subtopics
  id            uuid pk
  org_id        uuid
  topic_id      uuid  -> syllabus_topics.id
  code          text  ("1.1", "1.2")      nullable
  title         text  ("SI units")
  sort_order    int
  deleted_at    timestamptz
```

### 4.2 Per-enrollment snapshot (D1 = recommended)
When a student is enrolled in a subject, freeze the outline into their own copy so later edits to the
master do not disturb them. New students always snapshot from the current master.

```
student_syllabus            (one per student+subject)
  id            uuid pk
  org_id        uuid
  student_id    uuid
  subject_id    uuid
  source_note   text   ("AS Physics 9702, snapshot 2026-09-17")
  created_at    timestamptz

student_syllabus_item       (frozen subtopic rows + the coverage state on them)
  id                 uuid pk
  org_id             uuid
  student_syllabus_id uuid -> student_syllabus.id
  topic_title        text          (denormalised - frozen)
  topic_code         text
  subtopic_title     text
  subtopic_code      text
  sort_order         int
  -- coverage state lives on the same row (no separate join needed):
  status             text          ('pending' | 'in_progress' | 'covered')
  covered_on         date          nullable
  covered_by         uuid          nullable (teacher)
  session_id         uuid          nullable -> class_sessions.id (D2)
```

> If you overrule D1 to current-only: drop the two `student_syllabus*` tables and add instead a
> `syllabus_coverage(student_id, subtopic_id, status, covered_on, covered_by, session_id)` table that
> points straight at `syllabus_subtopics`. Simpler, but see Risk R1.

### 4.3 Notes
- Progress is computed, never stored: `% = covered items / total items` per `student_syllabus`.
- Weekly pace is derived from `covered_on` dates - no extra entry.
- Everything soft-deletes; nothing is hard-deleted (matches the rest of the app).

---

## 5. Screens / UX

### 5.1 Admin - Syllabus Manager (`/syllabus`)
- Pick subject (existing picker: name + code + program).
- Outline editor: add topic, add subtopic under it, drag to reorder, inline-edit title/code, remove
  (soft delete). Fast keyboard entry (Enter = new sibling, Tab = indent to subtopic).
- "Duplicate from another subject" helper (e.g. AS -> A2 starting point) to cut typing.
- If D3=parser: a "Paste outline" box that splits pasted text into topics/subtopics for review before save.

### 5.2 Teacher - marking (D2 = inside the class session view)
- On the session/student view, a **Syllabus** panel: topics -> subtopics checklist for that student.
- Tick to mark covered (sets today's date + the session, editable). Multi-select to mark several at once.
- Shows live `% covered`, count remaining, and a small weekly-pace line.

### 5.3 Student portal - read only
- "My Syllabus" per enrolled subject: the outline with covered items checked and a progress bar.
- Only their own subjects. No controls.

---

## 6. Progress tracking

- **Headline metric: cumulative coverage %** - "Ali - AS Physics: 26/54 (48%)."
- **Secondary: weekly pace** - subtopics covered per week, from `covered_on`. Enables a "behind pace"
  flag if a target finish date (e.g. exam month) is set.
- Class-wise progress does not apply (one-on-one, no class group). Weekly pace is the time-based view.

---

## 7. Yearly / syllabus-change workflow

With D1 = snapshot:
1. Cambridge publishes a new cycle. Admin edits the **master** outline for that subject in the Manager.
2. **Existing students are untouched** - they keep their snapshot and accurate progress.
3. **New students** snapshot the new master automatically on enrollment.
4. No archive UI to maintain; old snapshots are just frozen rows attached to old students.

This satisfies "only current syllabus is shown/maintained" while not breaking live students.

---

## 8. The real cost: content entry (read this)

The code is the easy part. Entering outlines is the project.

- One Cambridge syllabus ~= 10-20 topics x 5-15 subtopics = **100-300 lines**. AS Physics 9702 alone is 100+.
- Offering ~15-20 subject x program combos = **2,000-6,000 lines** of manual entry. Days to weeks of work,
  error-prone.
- **Coverage % is only as good as the outline.** A missing subtopic makes "100% covered" a lie and a
  student can walk into an exam missing content. This is an academic risk, not cosmetic.

Mitigations:
- **Start with only active subjects (D4).**
- **Paste-parser (D3)** to cut typing drastically - pending format research.
- Assign one owner for outline accuracy; treat outlines as reviewed content, not casual data.

---

## 9. Integration points

- `subjects` - outlines hang off subject rows (AS vs A2 already separate). Note: WHICH topics are AS vs
  A2 is a manual human split when entering (Cambridge ships 9702 as one document).
- `student_subjects` / enrollments - snapshot is created here on enroll.
- `class_sessions` (schedule) - marking ties to the session (D2); `session_id` on the item.
- Student portal - new read-only view gated to the student's enrollments.
- Teacher "My Classes" - marking panel gated to assigned students.

---

## 10. Phases, tasks, effort

| Phase | Tasks | Build effort |
|---|---|---|
| **1. Foundation + Manager** | Migrations (4.1, and 4.2 if D1=b); `/syllabus` admin screen: create/edit/reorder/remove topics+subtopics; duplicate-from-subject; (optional paste box). | ~1-1.5 days |
| **1b. Snapshot wiring (if D1=b)** | Snapshot on enrollment; backfill snapshots for current students. | ~0.5 day |
| **1c. Paste-parser (if D3=b)** | Parser + review UI. Needs format research first. | ~0.5 day |
| **2. Teacher marking + progress** | Coverage state writes; Syllabus panel on session/student view; multi-select; % + weekly pace calc; behind-pace flag. | ~1.5-2 days |
| **3. Student read-only view** | "My Syllabus" in portal, scoped to enrollments, progress bar. | ~0.5-1 day |

**Total code: ~4-5.5 days.** Real calendar timeline is gated by content entry (section 8) and teacher
adoption (Risk R4), not by code.

Each phase is shipped and reviewed before the next. Nothing pushed without your review.

---

## 11. Risks & mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Edit-in-place (D1=a) re-measures live students against a changed outline | Wrong % mid-course, esp. 2-year A-Level | Use snapshot (D1=b) |
| R2 | Content-entry volume | Weeks of manual work, typos | Active subjects only (D4) + paste-parser (D3) + a named owner |
| R3 | Outline inaccuracy | "100% covered" but content missed | Treat outlines as reviewed; spot-check vs official contents page |
| R4 | Teachers do not mark consistently | Progress data unreliable, worse than none | Tie to session (D2), multi-select, keep it 2 clicks |
| R5 | Coverage mistaken for readiness | False confidence with parents | Label as "covered", not "ready"; mastery mapping is a later, separate build on same tables |
| R6 | AS vs A2 topic split is manual | Mis-assignment of topics | Duplicate-from-subject helper + reviewer |

---

## 12. Needs more research before finalizing
1. Real **active subject x program list** for current 1-on-1 students (drives D4 and Phase 1 scope).
2. **Cambridge PDF format** - do contents pages split cleanly enough for a paste-parser? (drives D3).
3. Final call on **D1 snapshot vs current-only** (drives the schema).

---

## 13. Open decisions for owner (blockers for Phase 1)
- D1: snapshot per enrollment (recommended) or current-only edit-in-place?
- D2: mark inside class session (recommended) or standalone tab?
- D3: build paste-parser (after research) or type manually?
- D4: which subjects to enter first?

Once D1-D4 are answered, Phase 1 starts; everything else can follow iteratively.

---

## 15. Architecture decision - build on the archived scaffolding (2026-09-17)

The schema already has `syllabus_templates`, `syllabus_topics`, `syllabus_progress` (added 2026-08-03)
but they are **empty (0 rows)**, all enrollments have a null template, and the code marks the system
"archived" (app/students/actions.ts). The old design is 1-level (topics only), shared-topic coverage,
coarse program CHECK - wrong for our snapshot + 3-level + subtopic-coverage model.

Decision (D1=snapshot, D2=in-session, RETAIN VERSIONS):
- Owner refined the earlier "current-only" call: we now **keep every exam-year version** per subject
  (2025-2027, 2028-2030, ...), selectable via a version tab in the admin manager. The existing
  `syllabus_templates` table already supports this (academic_year + status active/archived).
- **Reuse** `syllabus_templates` = one row per subject PER exam-year version (academic_year = exam_years
  e.g. "2025-2027", cambridge_code e.g. "9702", status active/archived; multiple per subject, one active).
- Enrollment picks the version (default from the student's exam session) -> stored on
  `student_subjects.syllabus_template_id` (this previously-unused column now has meaning).
- Admin switches versions via a tab; a STUDENT is locked to one version (their exam session), never switches.
- **Reuse** `syllabus_topics`, ADD `code` ("1").
- **Add** `syllabus_subtopics` (code "1.1", title, `objectives` jsonb = the "Candidates should be able
  to" list, sort).
- **Add snapshot** `student_syllabus` (header) + `student_syllabus_item` (frozen topic/subtopic/objectives
  + coverage state: status, covered_on, covered_by, session_id). Coverage lives ON the item.
- AS vs A2 handled by separate subject rows (AS master = topics 1-11, A2 master = 12-25). No manual split.
- **Leave `syllabus_progress` dormant** for now (monthlyReport reads its count -> 0). Rewire monthly
  report to the new coverage in Phase 2, then drop it in a later cleanup.

Known downsides + mitigations:
- Snapshot freezes typos -> add a "re-sync student to current master" action (Phase 2), re-maps by
  subtopic code, preserves ticks.
- Enroll before a master exists -> no snapshot; a "generate missing snapshots" backfill fixes it
  (also snapshots the 5 current enrollments once outlines are built).

Phase 1 deliverables: migration (above) + admin Syllabus Manager (`/syllabus`) + auto-extract AS Physics
9702 & AS Maths 9709 from official PDFs for review + snapshot-on-enroll wiring + generate-snapshots backfill.

---

## 14. Findings - subject verification (2026-09-17)

Verified the live `subjects` table (queried directly, service-role read) against the official
Cambridge subject pages:
- AS & A Level: https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/
- IGCSE: https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/
- O Level: https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-o-level/subjects/

### 14.1 Structural finding (the big one)
The live table has **265 active rows** = the **same 42-subject template repeated across all programs**
(AS 42, A2 42, IGCSE 42, O1 42, O2 42, plus Edexcel AS/A2/IGCSE). Codes were then filled only where
Cambridge offers that subject at that level; where not offered the row exists with **(no code)**.

Consequence: many rows are **phantom** combinations Cambridge does not offer (e.g. A Level
"Statistics", A Level "Pakistan Studies", IGCSE "Psychology", O Level "Media Studies"). They can still
be picked/enrolled. Syllabus attaches per subject row, so phantoms = places to build an outline that
should not exist.

### 14.2 Codes: where a code IS set, it is essentially correct
Spot-checked all coded rows vs official; the set codes match Cambridge (Physics AS 9702, IGCSE 0625,
O Level 5054; Maths 9709/0580/4024; Chemistry 9701/0620/5070; etc.). Good.

### 14.3 Specific items to verify/fix (Cambridge only)
| Where | Row | Issue |
|---|---|---|
| A2 | Environmental Management 8291 | Official is **AS only** - no A Level. A2 row should not exist. |
| A2 | English General Paper 8021 | Official is **AS only** - no A Level. A2 row should not exist. |
| AS + A2 | Urdu 9676 | Not on current official AS/A page - verify still offered / discontinued. |
| AS + A2 | Thinking Skills 9694 | Not on current official AS/A page - verify still offered. |
| AS + A2 | Sport & Physical Education 9395 | Verify code + name (current Cambridge PE is 9396). |
| IGCSE | Urdu 0539 | Official current is First Language 0507 / Second Language 0520 - 0539 looks discontinued. |
| IGCSE | Islamiyat 0493 + Islamic Studies (no code) | Duplicate concept; official IGCSE is "Islamic Studies 0493". Keep one. |
| all levels | "(no code)" rows | Mostly phantoms (subject not offered at that level). Decide: delete, or hide from pickers. |

### 14.4 Active reality (drives D4 / Phase 1 scope)
Only **3 active enrollments** exist in the live system right now:
- AS Physics (9702) x1
- AS Mathematics (9709) x1
- O Level (O1) Art & Design (6090) x1

So Phase 1 needs outlines for a **handful** of subjects, not 30. This looks like early/test data;
the real active list should be re-checked when more students are enrolled.

### 14.6 Syllabus format check - AS Physics 9702 (2025-2027) [resolved D3 + D4]
Extracted the official 9702 PDF (pdftotext -layout). The format is clean and fully machine-readable:
- **3 levels:** Topic (`1`) -> Subtopic (`1.1`) -> Learning objectives ("Candidates should be able to:" numbered list).
- **AS vs A2 split is explicit in the doc:** AS = topics **1-11**; A Level = 1-11 **plus 12-25**. So the
  AS Physics row = topics 1-11, the A2 Physics row = topics 12-25. No manual judgment needed (kills Risk R6 for split subjects).
- **Physics counts:** AS = 11 topics / 32 subtopics; A2 = 14 topics / 44 subtopics; full A-Level = 25 / 76.
- Artifacts to clean on import: en-dashes render as a replacement char (convert to hyphen), µ symbol
  occasionally dropped, objective numbers sometimes glued to text. All easily normalised.

Decisions this resolves:
- **D3 -> auto-extract from official PDF, admin reviews** (NOT mass manual typing). Proven feasible; removes the
  biggest cost/risk (R2). Admin edits/reviews the generated outline instead of typing it.
- **D4 -> start with active subjects** (AS Physics 9702, AS Maths 9709), expand as students enroll.
- Coverage marking level: **subtopic** (e.g. tick "1.2 SI units"); learning objectives shown as read-only
  detail under each subtopic. ~32 ticks for an AS year - sane granularity.

Still open: **D1** (snapshot vs current-only) and **D2** (mark in-session vs standalone tab).

### 14.5 Recommendation before syllabus build
1. Do a quick **subject hygiene pass**: hide/remove "(no code)" phantom rows from pickers, drop the
   AS-only A2 phantoms (Env Management, English General Paper), resolve the Islamiyat/Islamic Studies
   duplicate, and confirm the Urdu / Thinking Skills / PE codes. Small, low-risk, and it stops
   phantom outlines later.
2. Then build syllabus outlines only for genuinely offered + actively-taught subjects.

