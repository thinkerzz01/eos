# Thinkerzz EOS — Maintenance & Change Guide

Practical guide for changing things **after go-live**. For the one-time launch
steps see `GO-LIVE.md`; for cron details see `CRON-SETUP.md`; for accepted
security-linter items see `SECURITY-NOTES.md`.

- **Live site:** https://portal.thinkerzz.com (hosted on **Vercel**)
- **Code:** GitHub `thinkerzz01/eos`, branch `main` → Vercel auto-deploys every push
- **Database & Auth:** Supabase project `suiikarwglsjmwnfefyt`
- **Cron:** external scheduler (Hostinger) hitting `/api/cron/*`
- **Email:** Resend · **Bot protection:** Cloudflare Turnstile

---

## 0. Golden rules (read first)

1. **Production does NOT use your `.env.local` file.** The live site reads env
   vars **only** from the **Vercel dashboard**. Editing `.env.local` changes
   only your local `npm run dev`.
2. **Never put quotes around a value in the Vercel dashboard.** Type
   `https://portal.thinkerzz.com`, never `"https://portal.thinkerzz.com"`.
   Quotes become part of the value and break things (this caused the
   "Invalid path specified in request URL" and build failures during launch).
3. **`NEXT_PUBLIC_*` values are baked in at build time.** After changing any of
   them in Vercel you must **redeploy** for the change to take effect.
4. **Never commit secrets.** `.env.local`, `.env*.local`, and `.env` are
   git-ignored. The bulk-import file is `.env.vercel.local` (also ignored).

---

## 1. Deploying / redeploying

- **Normal change:** push to `main` → Vercel builds and deploys automatically.
- **Force a rebuild without a code change:** Vercel → Deployments → **⋯** on the
  latest → **Redeploy**. (Use this after changing env vars.)
- ⚠️ **"Redeploy" rebuilds that deployment's commit.** To deploy newer code,
  push to `main` (or redeploy the newest deployment), don't redeploy an old one.
- **Check a deploy:** Vercel → Deployments → newest → status should be **Ready**
  (green). If **Error**, open it and read the **bottom** of the build log.

## 2. Changing environment variables (the #1 source of issues)

1. Vercel → your project → **Settings → Environment Variables**.
2. Edit the value — **no surrounding quotes, no leading/trailing spaces**.
3. Scope: **Production** (add Preview/Development if you also test there).
4. **Redeploy** (Deployments → ⋯ → Redeploy).

**Bulk update:** keep the local file `.env.vercel.local` as the source of truth.
To reset everything: delete all vars in Vercel → **Add Environment Variable →
Import .env** → upload/paste `.env.vercel.local` → redeploy.

Key variables and what they do:

| Variable | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Bare origin only — **no** `/rest/v1/`, no trailing slash |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key | Safe to expose (browser needs it) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin key | **Secret** — never public |
| `NEXT_PUBLIC_SITE_URL` | Base URL for invite / reset links | Must be `https://portal.thinkerzz.com` in prod |
| `NEXT_PUBLIC_PORTAL_URL` | Portal URL shown to users | `https://portal.thinkerzz.com` |
| `CRON_SECRET_TOKEN` | Auth for `/api/cron/*` | Must **exactly** match the token in the Hostinger cron jobs |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Bot protection on public forms | Set **both** or neither |
| `RESEND_API_KEY` + `RESEND_FROM` | Email sending | `RESEND_FROM` = `Thinkerzz Academy <no-reply@portal.thinkerzz.com>` |
| `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN/CALENDAR_ID` | Google Meet/Calendar invites | Optional — invites off if unset |
| `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` | Report wording | Optional — falls back to plain text |
| `BOOKING_ORG_ID` | Org the public booking form uses | `00000000-0000-0000-0000-000000000001` |
| `BANK_*`, `MOBILE_WALLET_INFO` | Fee instructions shown to students | Public |
| `NEXT_PUBLIC_ACADEMY_WHATSAPP`, `NEXT_PUBLIC_ACADEMY_EMAIL` | Contact details | Public |

## 3. Running database changes (migrations)

1. Write/keep the SQL in `supabase/migrations/`.
2. Run it in **Supabase → SQL Editor** against the **production** project.
3. `supabase/RUN_THESE_MIGRATIONS.sql` is the cumulative "paste-and-run" file;
   all migrations are written to be **idempotent** (safe to re-run).
4. Do **not** run the demo seeds in prod (`seed_students.sql`, `seed_voucher.sql`,
   `seed_roles.sql`). Only `seed_admin.sql` + `seed_subjects.sql` are real setup.
5. To purge demo rows if any slipped in: `supabase/PROD_CLEANUP_demo_data.sql`
   (STEP 1 counts, STEP 2 deletes).
6. Note: Supabase's SQL editor drops `ON COMMIT DROP` temp tables between
   statements — write cleanup deletes with inline subqueries, not temp tables.

## 4. Common content/config changes

| I want to… | Where |
|---|---|
| Change fonts / typography | App → **Settings → Typography** (admin) — writes to DB, no deploy |
| Add / edit / remove subjects | App → **Subjects** (admin/manager) — writes to DB |
| Change bank / JazzCash fee details | Vercel env: `BANK_*`, `MOBILE_WALLET_INFO` → redeploy |
| Change academy WhatsApp / email | Vercel env: `NEXT_PUBLIC_ACADEMY_*` → redeploy |
| Change the sign-in greeting text | Code: `app/login/LoginClient.tsx` → `welcomeMessage()` |
| Add a teacher / student | App UI — auto-creates their login and emails a set-password link |

## 5. Rotating secrets

1. Generate a new value (e.g. PowerShell:
   `-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })`).
2. Update it in **Vercel** env vars (no quotes) → redeploy.
3. For `CRON_SECRET_TOKEN`: also update the token in **all three Hostinger cron
   jobs** so they still match.

## 6. Troubleshooting (symptoms we actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: `Error occurred prerendering /login` | `NEXT_PUBLIC_SUPABASE_*` missing/empty at build | Set them in Vercel (no quotes) → redeploy |
| Login/reset: **"Invalid path specified in request URL"** | `NEXT_PUBLIC_SUPABASE_URL` has quotes or a `/rest/v1/` path | Set it to the bare origin, no quotes → redeploy |
| Site shows **`DEPLOYMENT_NOT_FOUND`** | No successful production build yet | Get a build to go green; watch the newest deployment |
| Dashboard "System health" red (Email/Notifications/Calendar) | Those env values have quotes / not set | De-quote in Vercel → redeploy |
| Cron returns **401** / "Cron not running" | `CRON_SECRET_TOKEN` in Vercel ≠ token in Hostinger cron | Make them identical (no quotes) |
| Turnstile box doesn't appear / forms reject | Only one of the two Turnstile keys set | Set **both** keys → redeploy |
| Pages "open in a new tab", scroll dead | (historical) nonce CSP broke hydration | Keep the static CSP in `lib/supabase/middleware.ts` |

## 7. Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

- Local reads `.env.local` (quotes there are fine — dotenv strips them).
- `.env.example` is the tracked template of every variable (no real values).

## 8. Health check after any change

- Build is **Ready** (green) in Vercel.
- `https://portal.thinkerzz.com/login` loads and you can sign in.
- Dashboard **System health** panel is all green.
- `/book` shows the Turnstile box and a test booking submits.
- Adding a teacher sends an invite whose link points to `portal.thinkerzz.com`.
