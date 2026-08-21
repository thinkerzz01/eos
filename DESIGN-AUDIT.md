# Thinkerzz EOS — UI/UX & Visual-Design Audit

> Discovery-only sweep (2026-08-19) of design tokens, layout, shared UI, and all
> 16 internal screens + public pages. Not features, not security — **design
> quality & consistency**. Parked list to work through later.

---

## ✅ Cleanup pass 1 — done (2026-08-21)
Safe, high-leverage foundation fixes (verified by build):
- **App-wide keyboard focus rings** — one `:focus-visible` rule in `globals.css`
  (box-shadow ring that survives the many `focus:outline-none` utilities and
  follows each element's radius). Fixes §7's biggest a11y gap across every screen.
- **Stray second purple collapsed** — `#5A31F4`/`#3B1CCF` → brand `#5B47D6`/`#4F3DC7`
  across the 6 components that used it (DataTable, Drawer, teacher/student modals,
  ResultSlip). One brand purple now.
- **Dead pulse CSS removed** — `@keyframes redPulse` + unused `.ac-pulse`.
- **Shared `formatPKR()`** (`lib/format.ts`) — adopted in Dashboard + Teacher
  Payouts (both now round consistently). Centralizes §8's duplicated currency code.
- **Icon-button a11y** — `aria-label` added to Modal + Drawer close buttons, the
  theme toggle, and the notification bell.
- **Removed the fake "▲ System database" trend glyph** (Students KPI) — now a
  neutral caption.

## ✅ Cleanup pass 2 — done (2026-08-21): user-facing copy (§13)
Stripped developer jargon from every user-visible string (build-verified):
- All "Access Denied (RLS Level Security)" + "Per AGENTS.md §3.3…" screens
  (vouchers, payments, teacher-payouts, settings, audit-log, PortalLayout,
  LockedPanel) → plain "Access restricted / contact the academy owner" copy.
- Page titles aligned to sidebar labels + de-jargoned: "Fee Vouchers & Fee Cycle
  (Admin Only)" → "Fee Vouchers"; "Notification Queue & Cron Dispatcher" → "Email
  Queue"; "Append-Only System Audit Log (Admin Only)" → "Activity Log"; "Tests &
  CAIE Assessed Grades" → "Assessments"; "Demos Management & Teacher Assignment" →
  "Demos & Schedule"; "Add New Teaching Staff (Admin Only)" → "Add New Teacher".
- Settings "Postgres RLS Security Status" → "Data Security"; removed "(AGENTS.md
  §3.2)" etc.; SetPayRateModal + reports privacy banner de-jargoned.
(Comments in code still reference RLS/AGENTS.md — those are developer-facing, left
as-is.)

## ✅ Cleanup pass 3 — done (2026-08-21): shared Badge + lighter bolding
Owner approved the direction on a Leads reference, then rolled out (build-verified):
- **`components/ui/Badge.tsx`** created (tone: neutral/brand/success/warning/danger/
  info; consistent bordered pill, dark-mode aware).
- **Adopted across 10 screens** (Leads + Students, Teachers, Payments, Vouchers,
  Homework, Demos, Teacher Payouts, Email Queue, Fees) — ~12 hand-rolled status
  pills replaced with `<Badge>`; conditional colour ternaries → tone ternaries.
- **Over-bolding trimmed** — ~16 table-body `font-extrabold`/`font-black` → 
  `font-semibold` (names, parent, program, etc.). Headings, KPI numbers, thead,
  modal titles, buttons left bold.

## ✅ Cleanup pass 4 — done (2026-08-21): shared Button
- **`components/ui/Button.tsx`** created (variant primary/secondary/ghost/danger +
  size md/sm; forwards all native button props; extra layout via className).
- **Adopted on the standard CTA buttons** across 8 files (Leads + Students,
  Teachers, Payments, Vouchers, Homework, Demos, Marketing) — 12 header/toolbar
  buttons. Conservative: buttons with non-standard sizing (modal footers, row
  action buttons) were intentionally left as-is to avoid layout regressions —
  those can migrate later, or Button can gain the matching sizes.

**Still open (lowest priority — deeper refactors, low visible payoff now):** adopt
`DataTable`/`KPICard` across all screens (§1, big table restructure — do per-screen
with visual review), migrate the remaining non-standard-size buttons, wire design
tokens into Tailwind + replace remaining hardcoded hex (§5). The high-value,
visible design work (pills, focus rings, one purple, plain-English copy, reduced
bolding, consistent primary buttons) is complete.

---

## TL;DR
The screens are **more consistent than they look** in the fundamentals: every page
header shares the same typography, the primary purple `#5B47D6`/hover `#4F3DC7` is
near-universal, and Sidebar/TopBar are single sources of truth. The uniform-heading
work landed.

The real problems are **systemic, not per-pixel**:
- A full set of shared primitives (`DataTable`, `KPICard`, `Modal`, `Drawer`)
  **exists but is barely used** — 13 screens hand-roll their own tables/cards, so
  styling drifts screen by screen.
- Design **tokens in `globals.css`/`tailwind.config.js` are mostly dead**; screens
  hardcode hex (~99 occurrences across 30 files).
- **Over-bolding is rampant** (~770 bold utility uses) — against the stated
  preference.
- **No focus-visible rings anywhere** in the internal app (keyboard a11y gap).

### Top 5 fixes by leverage
1. **Adopt shared primitives** (`DataTable`/`KPICard`, add `Button`+`Badge`) across
   all screens — kills most consistency drift at once.
2. **Add app-wide `focus-visible` rings + `aria-label`s** on icon buttons.
3. **Wire tokens into Tailwind, replace hardcoded hex**; collapse the stray
   `#5A31F4` → `#5B47D6`.
4. **Dial back `font-extrabold`/`font-black`** to medium/semibold for non-heading
   text (owner preference).
5. **Centralize `formatPKR()`** and right-align numeric columns.

---

## 🔴 High impact

### 1. Shared primitives abandoned — every screen reinvents the table
`components/ui/DataTable.tsx` is imported by **one** screen (`app/fees/FeesClient.tsx`).
`components/ui/KPICard.tsx` is used by **zero**. 13 screens hand-roll raw `<table>`
markup (32 table blocks) and inline KPI-card divs
(e.g. `app/students/StudentsClient.tsx:568-644`). The polished DataTable styling
only appears on Fees; everywhere else diverges.
**Fix:** adopt `DataTable`/`KPICard` across screens — or delete them and pick one
standard. Don't ship both.

### 2. Table cell padding varies screen-to-screen
DataTable uses `px-5 py-4`; hand-rolled tables use `py-3.5 px-3`
(`app/marketing/MarketingClient.tsx:195`,
`app/teacher-payouts/TeacherPayoutsClient.tsx:268`), `py-3 px-4`, `py-8`/`py-10`
for empty rows (~175 mixed padding tokens across 13 files).
**Fix:** one cell-padding scale (adopt DataTable).

### 3. Empty-state pattern inconsistent
DataTable renders a proper empty state (icon + title + description). Every
hand-rolled table drops a bare `<td colSpan>` text row, and even those disagree:
`py-8 text-[#6B7185]` (`app/leads/LeadsClient.tsx:395`,
`app/payments/PaymentsClient.tsx:205`) vs `py-10 text-slate-400 font-semibold`
(`app/teacher-payouts/TeacherPayoutsClient.tsx:252`,
`app/email-queue/EmailQueueClient.tsx:118`).
**Fix:** one shared empty-state component.

### 4. Over-bolding — against the stated preference
~349 `font-extrabold`/`font-black` + ~424 `font-semibold`/`font-bold` across 16
screens. `StudentsClient.tsx` alone: 115 extrabold/black + 75 semibold/bold.
`DataTable.tsx:119` sets the whole `<tbody>` to `font-semibold`. Nothing reads as
emphasized because everything is bold.
**Fix:** reserve bold/extrabold for numbers + true headings; body/labels →
`font-medium`.

### 5. Design tokens defined but unused; hex hardcoded everywhere
`globals.css` defines `--muted`, `--line`, `--amber`, `--green`, `--radius`,
`--shadow`; `tailwind.config.js` extends `violet`/`ink` — yet screens write raw
`#5B47D6`, `#EBEDF3`, `#6B7185`, `#12A150`, `#E5484D` inline (99 hex across 30
files). The token layer provides no value as-is.
**Fix:** map tokens into the Tailwind theme, replace hex with semantic classes.

### 6. No focus-visible rings anywhere in the internal app
`focus-visible`/`focus:ring` appears only on public/auth pages (login, book,
onboarding). Every internal button/input uses `focus:outline-none` + at most a
`focus:border` change. Keyboard users get no visible focus on the whole admin
surface.
**Fix:** shared `focus-visible:ring-2 ring-[#5B47D6]/50` on buttons/inputs.

### 7. Icon-only buttons lack accessible names
`aria-label` in only 3 files. TopBar bell + theme toggle use `title` only; modal/
drawer close buttons have neither. (`RowActionsMenu.tsx:69` is the good example.)
**Fix:** `aria-label` on all icon-only controls (`title` isn't a reliable
accessible name).

---

## 🟡 Medium impact

### 8. Primary button hand-rolled ~40× with drifting weight/padding/shadow
All use `bg-[#5B47D6] hover:bg-[#4F3DC7]` (good), but weight swings
`font-bold`→`font-extrabold`→`font-black`; padding `h-[38px] px-4`/`px-4 py-2`/
`px-5 py-2.5`/`px-3 py-1.5`; shadow `sm`/`md`/`xs`. No `Button` primitive.
**Fix:** `components/ui/Button.tsx` with primary/secondary/ghost/danger variants.

### 9. Status badges inlined per-screen, no shared helper
No `StatusBadge` exists. Each screen writes its own pill with differing weight/
padding/border (`app/leads/LeadsClient.tsx:424,431,445,501` vs
`KPICard.tsx:59-61`).
**Fix:** one `Badge` component with a `tone` prop — reuse the tone map already in
`RowActionsMenu.tsx:19-25`.

### 10. Most dialogs bypass Modal/Drawer primitives
`Modal.tsx`/`Drawer.tsx` are solid (Esc-to-close, scroll-lock, backdrop) but only
the teacher/student modal wrappers use them. Most in-screen dialogs are hand-built
`fixed inset-0` overlays (schedule/vouchers/demos/payments) — no Esc-to-close or
scroll-lock for free.
**Fix:** route all dialogs through `Modal`/`Drawer`.

### 11. Two brand purples coexist
Most of the app uses `#5B47D6`; `DataTable.tsx:71,111`, `Drawer.tsx:76-77`, and
several modals use `#5A31F4` for active chips/tabs/focus borders. Two near-identical
purples read as a bug up close.
**Fix:** converge on `#5B47D6`.

### 12. Card border-radius ad-hoc
Mix of `rounded-2xl`, `rounded-[18px]` (`StudentsClient.tsx:528`,
`LeadsClient.tsx:250,280`), `rounded-[16px]` (`StudentsClient.tsx:569`).
`globals.css --radius: 16px` referenced by nothing.
**Fix:** one card-radius token.

### 13. Page-title wording inconsistent + leaks internal jargon
Titles swing from terse ("Receipts", "Teacher Payouts") to verbose/technical
("Fee Vouchers & Fee Cycle (Admin Only)" `VouchersClient.tsx:304`, "Notification
Queue & Cron Dispatcher" `EmailQueueClient.tsx:39`, "Append-Only System Audit Log"
`AuditLogClient.tsx:44`). Titles don't match sidebar labels. "Access Denied (RLS
Level Security)" screens even cite `AGENTS.md §3.3` to end users
(`PaymentsClient.tsx:131-132`).
**Fix:** consistent user-facing title voice; align with sidebar labels; strip dev
jargon (RLS, cron, AGENTS.md) from user-visible copy.

### 14. No per-screen loading states / skeletons
No `Client.tsx` has isLoading/spinner/skeleton. Only loading UI is the global
`app/loading.tsx` (generic dashboard shape for every route). Mutations show
text-only feedback ("Saving…") with no spinner.
**Fix:** per-route skeletons matching each layout; spinners on async buttons.

### 15. Currency formatting duplicated & divergent
`PKR ${n.toLocaleString()}` re-implemented per file: `fmtPkr` w/ `Math.round`
(`DashboardClient.tsx:48`), `fmt` (`TeacherPayoutsClient.tsx:65`), inline elsewhere.
Dashboard rounds; others don't; payments prefixes `+PKR`/`-PKR`.
**Fix:** one `formatPKR()` in `lib/`.

### 16. Form inputs not programmatically tied to labels
Public pages use `htmlFor`; internal modals render `<label>` as a bare sibling of
`<input>` with no `htmlFor`/`id` (`PaymentsClient.tsx:258`, `LeadsClient.tsx:652`).
**Fix:** matching `id`/`htmlFor`.

### 17. Clickable non-semantic divs
KPI cards/rows use `onClick` on `<div>` (`KPICard.tsx:35`, Students KPI strip) with
no `role`/`tabIndex`/key handler — not keyboard-reachable.
**Fix:** `<button>` or `role="button"` + `tabIndex` + key handler.

### 18. Hand-rolled tables rely on ad-hoc (or missing) `overflow-x-auto`
Wide finance/payout tables with `font-mono` amounts can overflow on small screens.
**Fix:** standardize via DataTable's wrapper.

---

## 🟢 Low impact / polish

- **Dead pulse animation** — `globals.css:62-73` still defines `@keyframes redPulse`
  + `.ac-pulse`, referenced nowhere. Delete (pulsing was removed; leaving the
  definition invites reuse). `animate-pulse` otherwise only in the legit skeleton.
- **Non-standard font sizes** — `text-[13.5px]` (Sidebar), `text-[12.5px]`
  (`StudentsClient.tsx:574`), `text-[13px]` (RowActionsMenu). Snap to `text-xs`/`sm`.
- **Numeric columns inconsistently right-aligned** — `text-right`/`tabular-nums` in
  only 6 of 13 table screens. Right-align + `tabular-nums` all numeric columns.
- **Disabled opacity inconsistent** — `opacity-50`/`60`/`40`. Pick one.
- **Icon sizing drifts** — Sidebar `w-[18px]`, TopBar `w-4`/`w-4.5`/`w-5`. All
  Lucide (good). Settle conventions.
- **Quick-Action menu rainbow** — each item a different icon color
  (`TopBar.tsx:112-183`). Mild.
- **Global search desktop-only** — `TopBar.tsx:79` `hidden xl:block`, no mobile
  affordance. (Also: the search is non-functional — see FEATURE-BACKLOG.md.)
- **Modal close button no `aria-label`** — `Modal.tsx:60-65`, `Drawer.tsx:59-64`.
- **"▲ System database" pseudo-indicator** — `StudentsClient.tsx:578` decorative
  green triangle with no real trend meaning. Drop or make meaningful.

---

## What's genuinely consistent (credit where due)
- **Page headers** — identical typography/structure across all 14 internal screens.
- **Primary color** — `#5B47D6`/hover `#4F3DC7` near-universal (the `#5A31F4` drift
  is confined to 6 shared components).
- **Sidebar & TopBar** — single components; dark `#12142A` sidebar matches intent.
- **Icons** — Lucide throughout, no mixed sets.
- **Amber accent** — used semantically (warnings/fees), not sprayed as decoration.
  No stray gold. Matches the "sparing" intent.
- **Modal/Drawer primitives** — where used, correctly do Esc-to-close + scroll-lock.

---

### Suggested first thread when we resume
**Build the shared primitive set** (`Button`, `Badge`, adopt `DataTable`/`KPICard`)
and roll it across screens. That single effort resolves the bulk of the High/Medium
consistency findings (tables, padding, empty states, badges, buttons, over-bolding,
focus rings) in one coordinated pass, instead of patching 13 screens ad-hoc.
