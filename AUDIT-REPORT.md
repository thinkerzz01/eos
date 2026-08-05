# Thinkerzz EOS — Independent Project Audit

**Date:** 2026-08-04
**Auditor:** Claude (Opus 4.8) — code, schema, security, docs & live-app review
**Scope reviewed:** Master Plan v3.1, AGENTS.md, Developer Guide, `schema.sql` + migration, all 21 `app/**/page.tsx` screens, `components/**`, `lib/**`, `middleware.ts`, auth flow, and the running app at `http://localhost:3000`.

---

## 1. Headline verdict

This is a **two-speed project**, and the two speeds are not connected to each other:

- **Speed A — genuinely excellent:** the governance documents, the PostgreSQL **database schema**, and the **visual/UI design system** are strong, disciplined, and largely faithful to the plan.
- **Speed B — not built yet:** the running application is a **high-fidelity front-end demo powered entirely by hardcoded mock data**. It does not read from or write to the database, and its single most important promise — *"Security is the product, not polish"* (Master Plan §14) — is **not implemented in the live app**.

The most important sentence in this report: **`PROGRESS.md` says "100% COMPLETE — ALL 7 PHASES SHIPPED", and that is not accurate.** What exists is roughly *a beautiful UI shell (≈90% done) + a production-grade schema (≈85% done) + zero wiring between them + missing Phase 6 backend*. The overstated status is itself the highest-risk finding, because it can lead to launching an unsecured system in the belief that it is finished.

Anti-gravity (the AI builder) produced excellent *artifacts in isolation* but did not integrate them into a working, secured product.

---

## 2. What is genuinely good (keep this)

| # | Strength | Evidence |
|---|----------|----------|
| G1 | **The database schema is production-grade.** | [schema.sql](schema.sql): RLS enabled on all 35 tables via a `DO` loop (L637), 32 `CREATE POLICY` statements, `audit_log` AFTER-trigger attached to every table (L611–613), soft-delete `deleted_at` + global columns everywhere. |
| G2 | **The hard security rules from the plan are correctly modelled in SQL.** | `teacher_pay_rates` is a separate table (L134); Manager is correctly *excluded* from the finance/settings/audit tables in the manager policy loop (L700–712) and made **read-only** on `teachers` (L715); the booking `EXCLUDE USING gist` constraint is correctly scoped `WHERE (deleted_at IS NULL AND teacher_id IS NOT NULL)` (L326–331). This is exactly what §3.3/§3.4 of AGENTS.md demand. |
| G3 | **Governance discipline is rare and valuable.** | [AGENTS.md](AGENTS.md) + [Master Plan](Thinkerzz-EOS-Master-Plan-v3.1.md) form a clear decision ledger with locked invariants. Most solo projects never reach this clarity. |
| G4 | **The UI design system is cohesive and professional.** | Consistent brand palette, dark mode, responsive grids, role-specific dashboards, and a real component library ([DataTable](components/ui/DataTable.tsx), [Drawer](components/ui/Drawer.tsx), [Modal](components/ui/Modal.tsx), [KPICard](components/ui/KPICard.tsx), [Toast](components/ui/Toast.tsx)). |
| G5 | **Several locked policy rules are correctly applied in the mock logic.** | The v3.1 "paid within grace = 100" fee-timeliness rule is implemented in the dashboard health calc ([app/page.tsx:79](app/page.tsx)); [lib/security.ts](lib/security.ts) has a correct PII sanitizer (first-name only), a correct cron `Bearer` check, and a correct overlap re-check helper. |
| G6 | **Secret hygiene is correct.** | `.env.local` is gitignored and **not** tracked in git; service-role key is kept server-side only. |

---

## 3. Critical & high findings (ranked)

### 🔴 C1 — The app is completely disconnected from the database *(Critical)*
Only **one** file in the entire `app/` tree touches Supabase: [app/login/page.tsx](app/login/page.tsx). All **15 data screens** import from `lib/mock*Data.ts` and render static arrays. Nothing is persisted, nothing is queried, and therefore **none of the excellent schema in G1/G2 is ever exercised.** The RLS policies, audit triggers, and EXCLUDE constraint are dormant.
> **Impact:** The product cannot actually run an academy. Every number on screen is fictional.

### 🔴 C2 — Route protection is a no-op; auth can be bypassed in one click *(Critical)*
[lib/supabase/middleware.ts:52-57](lib/supabase/middleware.ts): when there is **no logged-in user**, the middleware still `return response` (lets the request through). There is no `redirect('/login')`. Every route is publicly reachable. On top of that:
- The login page has a **"Explore Portal Demo Mode (1-Click Access)"** button that just sets a `demo_mode=true` cookie and grants full admin ([app/login/page.tsx:196-210](app/login/page.tsx)).
- Login **auto-creates an `admin` account for any email/password** that doesn't exist yet ([app/login/page.tsx:44-73](app/login/page.tsx)).
> **Impact:** This is the direct opposite of the plan's #1 promise (RLS deny-by-default, §14). Anyone reaching the URL is an admin.

### 🔴 C3 — Security is *theater*: the "RLS lock" is client-side and fake *(Critical)*
Role comes from [RoleContext](components/ui/RoleContext.tsx), which **defaults to `admin` and is switchable in the browser** with no server involvement. [PortalLayout](components/layout/PortalLayout.tsx:61-77) and [LockedPanel](components/ui/LockedPanel.tsx) render authoritative-looking strings like *"RLS DENY ENGINE: Supabase table policy denied SELECT for role"* — while making **zero database calls.** AGENTS.md §3.3 explicitly warns *"Never rely on the UI"* as the lock; here the UI *pretends to be* the lock.
> **Impact:** Worse than no security, because it looks enforced. A manager could read finance by switching the context value.

### 🟠 C4 — `PROGRESS.md` materially overstates completion *(High)*
[PROGRESS.md](PROGRESS.md) claims *"100% COMPLETE (PHASES 1 TO 7 FULLY SHIPPED)."* In reality, **Phase 6 (Intelligence) has no backend at all** — there is **no `app/api/` directory**, so no `/api/cron/reminders`, no notification-queue drain, no monthly-report LLM endpoint, none of the priority/retry sender described in Master Plan §3.2–3.3. The public booking endpoint (`/book`, `/api/public`) is referenced in middleware but doesn't exist as a page/route.
> **Impact:** Business/decision risk — it invites shipping an unfinished, unsecured system.

### 🟠 C5 — `lib/security.ts` is dead code, and one helper is dangerously fake *(High)*
Nothing in `app/` imports [lib/security.ts](lib/security.ts); the real screens gate via the client `allowedRoles` prop instead. Worse, `generateSignedStorageUrl()` ([lib/security.ts:104-107](lib/security.ts)) **fabricates a URL string** (`?token=exp_..._signed_token`) that is *not* a real Supabase signed URL. Real signing is async, server-side, and returns a cryptographically signed token.
> **Impact:** If anyone wires this in believing it secures the private document vault, files will be either inaccessible or, worse, mis-secured.

### 🟡 C6 — Demo data is internally inconsistent *(Medium — acceptable in a demo, must not reach the build)*
On the live dashboard: header says *"Showing 50 filtered students"* but *"Active Students 30"*; academy health computes to **83%** yet the breakdown card hardcodes *"Student Health 88%"*; teacher/class/revenue counts (32 / 48 / PKR 1,248,750) are hardcoded; *"Today's Schedule"* is dated **"Mon, 19 May 2025"** (stale, and inconsistent with the 2026 project timeline). The "Sara Khan 72%" capacity name doesn't reconcile across screens.

### 🟡 C7 — The "live health engine" is not actually live *(Medium)*
The Students screen mostly reads a **precomputed `healthBand`** from mock data and **hardcodes `homeworkPct: 85`** on CSV import ([app/students/page.tsx:321-322](app/students/page.tsx)) rather than computing Health from the locked formula (`0.50·Att + 0.30·HW + 0.20·Fee`). The formula only appears, partially, on the dashboard.

### 🟢 C8 — Repo hygiene *(Low)*
Root still carries `dashboard.html` and the 144 KB `thinkerzz-eos-demo-v3.html` prototype, plus a set of deleted-but-unstaged `V3/*` files (per `git status`). Two doc formats (`.docx` + `.md`) risk drift. Clean these before they confuse the source-of-truth hierarchy.

---

## 4. Visual / UX review

**Strengths:** genuinely attractive, consistent spacing and radii, coherent purple/indigo brand, working light/dark themes, sensible role-specific dashboard layouts, good empty-state and modal patterns in the component library.

**Issues to fix:**
1. **Typography is too small.** Almost everything is `text-xs` / `text-[11px]` / `text-[10.5px]`. This hurts readability and accessibility (WCAG). Establish a type scale with a `text-sm`/`text-base` body minimum.
2. **Placeholder links.** Several `<a href="#">` on the Students screen go nowhere ([app/students/page.tsx](app/students/page.tsx) L519+).
3. **Contrast** on some white text over mid-tone gradients is borderline; verify against WCAG AA.
4. **Cross-screen data drift** (see C6) makes the demo feel less trustworthy in a walkthrough.

---

## 5. Plan-adherence scorecard (by build phase)

| Phase | Schema/DB | UI screen | Wired & secured (live) |
|-------|:--------:|:---------:|:----------------------:|
| 1 · Foundation (auth, RLS, roles) | ✅ Strong | ✅ Login UI | ❌ Middleware bypass, client-side roles |
| 2 · Core records (students/teachers/syllabus) | ✅ | ✅ | ❌ Mock only, no persistence |
| 3 · Admissions + public booking | ✅ | ✅ Leads/Demos UI | ❌ No `/book` route, no `/api/public` |
| 4 · Academics (schedule, conflict, homework) | ✅ EXCLUDE constraint | ✅ | ⚠️ `doAssign` re-check exists only in unused `lib/security.ts` |
| 5 · Money (Admin-only, partial, refund) | ✅ | ✅ Good mock flows | ❌ Admin-only enforced client-side only |
| 6 · Intelligence (cron, queue, LLM report) | ⚠️ tables exist | ⚠️ email-queue UI mock | ❌ **No backend at all — not built** |
| 7 · Support & polish (tickets, settings, audit) | ✅ | ✅ | ❌ Mock only |

**Honest completion estimate:** UI ≈ 90%, Schema ≈ 85%, **integrated & secured product ≈ 10–15%.**

---

## 6. How to fix it — prioritized remediation roadmap

**Do these in order. The first one costs nothing and de-risks everything.**

### Step 0 — Correct the record (today)
Rewrite `PROGRESS.md` to reflect reality: *"UI prototype + schema complete; data layer, auth enforcement, and Phase 6 backend not yet built."* Everything else depends on planning from a true baseline.

### Step 1 — Make auth real and close the bypass *(Phase 1 completion)*
1. In [middleware.ts](lib/supabase/middleware.ts), **redirect unauthenticated users to `/login`** (`return NextResponse.redirect(new URL('/login', request.url))`) for non-public routes. Remove the "let through" branch.
2. **Delete the demo-bypass button and the `demo_mode` cookie**, and **remove the auto-signUp fallback** in [app/login/page.tsx](app/login/page.tsx). Account creation is an Admin action, not a login side effect.
3. Derive role **server-side from the `profiles` table**, not from a client `useState`. Feed it down; keep `RoleContext` only as a read-only mirror of the server value.

### Step 2 — Wire one screen end-to-end as the reference pattern
Pick **Students**. Convert it to a Server Component that queries Supabase (respecting RLS), passing data to the existing presentational UI. Prove that: (a) an admin sees data, (b) a manager is denied finance, (c) a teacher sees only their students — **test the denial case**, per AGENTS.md §7. Then replicate the pattern across the other 14 screens, deleting each `lib/mock*Data.ts` as you go.

### Step 3 — Build the Phase 6 backend (the actually-missing phase)
Create `app/api/`:
- `api/cron/reminders` — guarded by the `Authorization: Bearer` check (reuse the correct helper in `lib/security.ts`), enqueues into `notifications`.
- The **queue-drain sender** with priority 1→2→3, the Resend 100/day cap, idempotency by `unique_key`, and `failed`/`retry_count` handling.
- `api/cron/monthly-reports` — assembles the report in code, sends **first-name + facts only** to the LLM for phrasing.
- `api/public/*` + a real `/book` page limited to the two locked functions.

### Step 4 — Replace fakes and remove dead code
- Replace `generateSignedStorageUrl` with a real `supabase.storage.from(...).createSignedUrl()` call (async, server-side).
- Either wire `lib/security.ts` into real server checks or delete it so it can't mislead.
- Delete `LockedPanel`/`PortalLayout` "RLS DENY ENGINE" strings unless a real DB denial actually produced them.

### Step 5 — Polish
Fix the demo data inconsistencies (C6), compute Health from the real formula (C7), raise the base type size (§4.1), fix placeholder links, and clean repo cruft (C8).

---

## 7. One-paragraph summary for the owner

You have an **excellent blueprint, an excellent database, and a beautiful front-end** — three strong halves that have never been joined. What you do **not** yet have is the product the Master Plan describes: a live, database-backed, RLS-secured academy system. The running app is a convincing demo on fake data, and its security is currently a visual imitation rather than a real enforcement layer. None of this is wasted work — the schema and UI are exactly what a finished product needs — but the honest completion figure is closer to **10–15% of an integrated, secure system**, not 100%. Fix the status note first, make authentication real, then wire the screens to the database one at a time using the schema you already built. Once that connection is made, this becomes a genuinely impressive product.
