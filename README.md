# Thinkerzz EOS

Academy Operating System and portal suite for Thinkerzz - CRM, demo booking,
enrollment, scheduling (with Google Meet), fees and vouchers, teacher payouts,
reports, and role-based portals (admin, manager, teacher, student).

Built with **Next.js 14** (App Router) + **Supabase** (Postgres, RLS, Auth,
Realtime) + **Tailwind CSS**. Email via **Resend**, calendar via **Google
Calendar/Meet**.

---

## 1. What's inside

- **Public booking** (`/book`) - anyone can book a free 30-minute demo class.
- **Leads and demos** - the booking becomes a lead; assigning a demo creates a
  Google Meet link and calendar invites.
- **Convert to student** - marks the first month paid, starts the 30-day fee cycle,
  and can send a per-student **onboarding link** (`/onboarding/<id>`).
- **Auto-provisioned logins** - adding a teacher or enrolling a student creates their
  Auth account and emails a "set your password" link (`/set-password`).
- **Fees and vouchers** - create vouchers, record payments (Bank Transfer / JazzCash),
  preview and send vouchers on WhatsApp with bank/JazzCash details.
- **Teacher payouts** - record payments to teachers.
- **Reports** - monthly parent progress reports (generated manually or via cron),
  printable.
- **Dashboard** - finance graphs, forecast, collection rate, filters.
- **Strategic IDs** - every record has a human code (`TZ-STU-0001`, `TZ-VCH-0001`, ...).
- **Role portals** - one login, role decides the view; enforced by Postgres RLS.

Public pages (no login): `/book`, `/enroll/<leadId>`, `/onboarding/<studentId>`,
`/set-password`, `/login`. Everything else requires a session.

---

## 2. Local setup

1. Install: `npm install`
2. Create `.env.local` (see "Environment variables" below).
3. Run: `npm run dev` -> http://localhost:3000
4. Type-check: `npx tsc --noEmit` (do NOT run `next build` while `next dev` is running).

### Environment variables (`.env.local`, never committed)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin (never exposed to the browser) |
| `RESEND_API_KEY` | email sending |
| `RESEND_FROM` | verified sender, e.g. `Thinkerzz <no-reply@portal.thinkerzz.com>` |
| `NEXT_PUBLIC_SITE_URL` | app base URL (set-password / invite links point here) |
| `NEXT_PUBLIC_ACADEMY_WHATSAPP` | WhatsApp number for public "Need Help?" CTAs (digits only) |
| `CRON_SECRET_TOKEN` | Bearer token the cron endpoints check |
| `BOOKING_ORG_ID` | org the public `/book` page writes leads for |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` / `GOOGLE_CALENDAR_ID` | Meet + Calendar |
| `BANK_NAME_TITLE` / `BANK_ACCOUNT_NO` / `BANK_ACCOUNT_IBAN` / `MOBILE_WALLET_INFO` | shown on fee vouchers |
| `OPENROUTER_API_KEY` (+ `OPENROUTER_MODEL`) | optional warm phrasing for reports |

---

## 3. Database (Supabase)

**GitHub does not update Supabase.** Apply SQL yourself in the Supabase SQL Editor.

`schema.sql` is the single source of truth - it contains every table, RLS policy,
function, the strategic-code sequences, teacher payouts, onboarding, and the current
program labels.

**Fresh rebuild (recommended when you have only test data):**
1. `supabase/reset_database.sql` (wipes `public`; auth logins survive)
2. the whole `schema.sql`
3. Re-seed: your admin SQL (`seed_admin.sql` for `admin@thinkerzz.com`),
   `seed_subjects.sql`, and `seed_roles.sql` (manager/teacher/student test logins -
   create the Auth users first in Authentication -> Users).

Accounts: the very first admin is seeded by SQL because auth is deny-by-default. Real
teachers/students get logins automatically (add teacher / enroll student). Turn OFF
"Allow new users to sign up" in Supabase Auth before launch.

Incremental migrations live in `supabase/migrations/` (only needed if you do NOT reset).

---

## 4. Deploy (Vercel + subdomain)

1. Import the repo in Vercel (framework auto-detects Next.js).
2. Add all env vars (section 2), with `NEXT_PUBLIC_SITE_URL=https://portal.thinkerzz.com`.
3. Deploy, then Settings -> Domains -> add `portal.thinkerzz.com` (CNAME `portal` ->
   `cname.vercel-dns.com`).
4. Supabase -> Authentication -> URL Configuration: Site URL + redirect URLs to
   `https://portal.thinkerzz.com/**`. Turn OFF public sign-ups.
5. Resend: verify the sending domain, set `RESEND_FROM`.

---

## 5. Cron jobs

Set these in your hosting cron (cPanel). Each calls the live app with the Bearer
token. Times are server-timezone (subtract 5h if the host is UTC and you want PKT).

| URL | Suggested schedule | Purpose |
|---|---|---|
| `https://portal.thinkerzz.com/api/cron/send` | `*/15 * * * *` | drain the email queue |
| `https://portal.thinkerzz.com/api/cron/reminders` | `0 7 * * *` | fee / grace / class reminders |
| `https://portal.thinkerzz.com/api/cron/backup-export` | `0 2 * * 0` (weekly Sun) | full DB backup to JSON |
| `https://portal.thinkerzz.com/api/cron/monthly-reports` | run manually / month-end (28th) | queue parent reports |

Command example (schedule goes in the timing fields, NOT the command):
```bash
curl -s -H "Authorization: Bearer <CRON_SECRET_TOKEN>" https://portal.thinkerzz.com/api/cron/send >/dev/null 2>&1
```
Backup (saves a dated file; escape the `%` as `\%` in cron):
```bash
mkdir -p ~/backups && curl -s -H "Authorization: Bearer <CRON_SECRET_TOKEN>" https://portal.thinkerzz.com/api/cron/backup-export -o ~/backups/thinkerzz-$(date +\%F).json
```

On-demand backup: an admin can also download a full backup from **Settings -> API
Secrets & Integrations -> Download Full Backup** (`/api/admin/backup`, uses the admin
session, no token needed).

---

## 6. Notes and conventions

- Verify with `npx tsc --noEmit`; never run `next build` while the dev server runs.
- Google Meet/Calendar and email are best-effort - failures never break booking or
  scheduling.
- `FIXLOG.md` has the dated history of every change. `AGENTS.md` / the Master Plan hold
  the locked policies (RLS matrix, finance rules, timezone).
