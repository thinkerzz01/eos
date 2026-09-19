# Billing v2 - Plan and State

Status: PHASE 1-4 BUILT (monthly vs upfront billing, auto-voucher engine, next-month forecast, session capture on Add-Lead + public booking + convert prefill). Two SQL migrations pending owner run.

## 0. RESUME HERE

### 0.1 What this solves
The old model was monthly-only and uniform: one manual batch (`generateMonthlyVouchers`) cut one voucher per active student on ONE shared due date. It could not represent crash-course / upfront students, and it was a manual button.

New model, two independent choices per student, set at enrollment:
- Payment mode: `billing_mode = 'monthly'` (one voucher per month, auto-generated per student on their own cycle) OR `'upfront'` (one paid block, no monthly fees or reminders until it ends).
- Session / end: `billing_end_date` (the exam-session end) is the hard stop; billing stops after it. `billing_start_date` is the enrollment start.

Custom awkward dates (start 17th, exam 5th next month) are handled by explicit start/end date pickers.

### 0.2 Build status
- DONE: schema migration file, convert flow (monthly + upfront), auto-voucher cron engine, payment advances the cycle, next-month recurring forecast card.
- PENDING: owner runs the SQL migration.
- NOT STARTED: Phase 4 - session dropdown on the demo/booking + Add-Lead form and prefill into convert.

### 0.3 SQL to run (Supabase SQL Editor)
1. `supabase/migrations/2026-09-19_billing_modes.sql` - adds to `students`: `billing_mode` (default 'monthly'), `billing_start_date`, `billing_end_date`; adds to `leads`: `exam_session`. Idempotent. Existing students default to monthly with blank dates - no behaviour change. [OWNER RAN THIS on 2026-09-19]
2. `supabase/migrations/2026-09-19_booking_session.sql` - extends `create_public_booking` RPC to store the exam session picked on /book. Requires #1 first. [OWNER RAN THIS on 2026-09-19]

### 0.4 The billing engine
- `lib/cron/billing.ts` -> `runBilling(admin)`: for each active MONTHLY student whose `next_due_date` is within `LEAD_DAYS` (5) and not past `billing_end_date`, cut the next voucher (amount = monthly_fee, due = next_due_date, grace = +3). Upfront students are skipped. Idempotent: skips if a voucher for that student+period already exists.
- Wired into `app/api/cron/tick/route.ts` (phase 0) and `app/api/cron/reminders/route.ts`. Same pinger URL as before - no new cron entry needed.
- Cycle advance: `recordPayment` (app/vouchers/actions.ts) advances a monthly student's `next_due_date` by one calendar month when they fully pay the CURRENT cycle's voucher (its due_date == next_due_date). Unpaid cycles keep their due date so reminders keep chasing.
- `convertLead` (app/leads/actions.ts): monthly -> first month paid, next_due = start + 1 month. upfront -> one paid block voucher (period "Upfront <start> - <end>"), monthly_fee = 0, next_due parked past the end so the cron never bills it.

### 0.5 Forecast
- `lib/data/adminDashboard.ts` -> `AdminData.forecast` (BillingForecast): recurringNextMonth (sum of monthly fees for monthly students still billing next month), activeMonthly count, endingNextMonth + endingCount (churn: plans ending next month). BILLED, not collected; upfront blocks excluded (they are one-off, not recurring).
- Rendered in the Fees card, admin only: `app/_components/AdminDashboard.tsx`.

### 0.6 Key files
- `lib/date/ymd.ts` - date-only helpers (addDaysYMD, addMonthsYMD clamps day-of-month, monthLabelYMD, todayYMD, firstOfMonthYMD).
- `supabase/migrations/2026-09-19_billing_modes.sql` - the schema.
- `app/leads/actions.ts` - convertLead (billing modes), createLead (exam_session).
- `app/leads/LeadsClient.tsx` - convert modal: billing-plan toggle, start/end dates, conditional amount label.
- `lib/cron/billing.ts`, `app/api/cron/{tick,reminders}/route.ts` - the engine.
- `app/vouchers/actions.ts` - recordPayment cycle advance.
- `lib/data/adminDashboard.ts`, `app/_components/AdminDashboard.tsx` - forecast.

### 0.7 Worked examples (the agreed behaviour)
- Fresh monthly student: start 1 Sep, fee 8,000, mode monthly. Sep voucher paid at convert; next_due 1 Oct. Cron cuts the Oct voucher ~26 Sep; paying it rolls next_due to 1 Nov; repeats until billing_end_date.
- Crash course upfront: start 17 Sep, end 5 Nov, total 15,000, mode upfront. One 15,000 voucher (17 Sep - 5 Nov) paid; no monthly vouchers, no reminders; nothing after 5 Nov.
- Long-term monthly with session June 2027: billed the 1st each month automatically, stops after billing_end_date.

## 0.8 What is left / decisions parked
- Phase 4 DONE: session picker on Add-Lead modal + public /book form (shared `lib/sessions.ts`: Oct/Nov 2026, May/Jun 2027, Oct/Nov 2027, May/Jun 2028, Custom...), and convert modal prefills from `leads.exam_session`. Remaining SQL: run migration #2 above so the public form actually stores the session.
- No proration: last stub month is billed as a full month (owner confirmed simplest).
- Switch upfront -> monthly at block end: currently a manual edit of the student's billing_mode / dates. A one-click "renew as monthly" is a possible later add.
- `generateMonthlyVouchers` (manual batch) is KEPT as a fallback; the per-student cron is now the primary path.
