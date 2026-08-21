# Thinkerzz EOS — Go-Live Guide

Everything in the code, database, and security is done. What's left is dashboard
config only you can do (Vercel / Supabase / DNS). Work top to bottom; the whole
thing is ~30–45 min.

---

## 1. Vercel environment variables  ← the #1 blocker

Vercel → your project → **Settings → Environment Variables**. Add each below,
select **Production** (Preview too if you want), then **redeploy** (Deployments →
⋯ → Redeploy). Vercel does NOT read your local `.env` files — these must be typed
here.

### Required
| Variable | Public? | Value / where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase → API → `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | Supabase → API → `service_role` key. Never a `NEXT_PUBLIC_` name. |
| `NEXT_PUBLIC_SITE_URL` | public | `https://portal.thinkerzz.com` |
| `BOOKING_ORG_ID` | server | `00000000-0000-0000-0000-000000000001` (your org id) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | from your `.env.production.local` (Turnstile site key) |
| `TURNSTILE_SECRET_KEY` | **SECRET** | from your `.env.production.local` (Turnstile secret) |
| `RESEND_API_KEY` | **SECRET** | Resend dashboard → API Keys |
| `RESEND_FROM` | server | `no-reply@portal.thinkerzz.com` |
| `CRON_SECRET` | **SECRET** | a long random string (see step 4). Vercel Cron auto-sends this. |

### Google Calendar (for class/demo invites — required if you use calendar)
| Variable | Public? | Value |
|---|---|---|
| `GOOGLE_CLIENT_ID` | server | from Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | **SECRET** | from Google Cloud OAuth client |
| `GOOGLE_REFRESH_TOKEN` | **SECRET** | from an account you own; publish the consent screen to Production |
| `GOOGLE_CALENDAR_ID` | server | `primary` (or a specific calendar id) |

### Optional (safe to skip)
`NEXT_PUBLIC_ACADEMY_WHATSAPP` · `NEXT_PUBLIC_ACADEMY_EMAIL` ·
`NEXT_PUBLIC_EMAIL_LOGO_URL` (hosted logo for emails) · `NEXT_PUBLIC_PORTAL_URL` ·
bank details (`BANK_NAME_TITLE`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_IBAN`,
`MOBILE_WALLET_INFO`) — these are now editable in **Settings → Financial**, so you
can skip them and set them in-app instead.

> ⚠️ **Turnstile is now mandatory in production.** If the two Turnstile keys aren't
> set, the public booking/enroll/onboarding forms will block submissions (a safety
> default). Set them here.

---

## 2. Supabase Auth URLs

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://portal.thinkerzz.com`
- **Redirect URLs:** add `https://portal.thinkerzz.com/**` (keep
  `http://localhost:3000/**` for local dev)

Without this, the "Set your password" email link breaks on the live domain.

---

## 3. Resend sending domain (email deliverability)

Resend → **Domains → Add Domain** → `portal.thinkerzz.com`. Resend gives you a few
**DNS records** (SPF + DKIM). Add them in your DNS (Hostinger, where thinkerzz.com
DNS lives). Once verified, `no-reply@portal.thinkerzz.com` sends cleanly instead of
landing in spam.

---

## 4. Cron (reminders + emails auto-send) — mostly done in code

`vercel.json` (in the repo) already schedules the jobs:
- `/api/cron/tick` — hourly (enqueues reminders + drains the email queue)
- `/api/cron/monthly-reports` — 1st of each month, 6am
- `/api/cron/backup-export` — daily, 3am

**You only need to:** set the `CRON_SECRET` env var in Vercel (step 1) to a long
random string. Vercel Cron automatically attaches it as the auth token, and the
routes accept it. Nothing else to wire.

> **Plan note:** Vercel **Hobby (free)** limits cron to **once per day**. Hourly
> `tick` needs the **Pro** plan. If you're on Hobby, either upgrade, or use a free
> external pinger (e.g. cron-job.org) hitting
> `https://portal.thinkerzz.com/api/cron/tick` every 15 min with header
> `Authorization: Bearer <your CRON_SECRET>`.

---

## 5. (Recommended) Cloudflare in front of Supabase RPCs

The public booking/enroll/onboarding RPCs are callable directly with the anon key.
The app-layer rate limit is per-instance on serverless, so add a Cloudflare rate
rule on `*.supabase.co/rest/v1/rpc/*` for a hard cross-instance cap. Optional but
recommended before you advertise the booking link widely.

---

## 6. (Hygiene) Rotate early secrets

Any secret that was committed to git early in the project should be rotated (new
Supabase keys, new Resend key, new cron secret). Treat anything ever in git history
as exposed.

---

## ✅ 7. Live smoke test

On `https://portal.thinkerzz.com`:
1. Log in as admin.
2. Open `/book` → the Turnstile check appears → submit a test demo → it shows up in Leads/Demos.
3. Admit a test student (with subjects + a teacher) → they appear in Students.
4. Confirm the student got a "Set your password" email.
5. Check the notification bell + a couple of tabs load quickly.

If those pass, **you're live.** 🎉

---

## Reminder: run the migrations on the PRODUCTION database

If your Vercel project points at a **different** Supabase project than your local
dev, run everything in `supabase/RUN_THESE_MIGRATIONS.sql` on that production DB
too. (If it's the same project you've been running migrations on, you're set.)
