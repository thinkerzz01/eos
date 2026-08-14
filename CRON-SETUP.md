# Thinkerzz - Cron / Automation Setup

The app does not schedule itself. An external scheduler must call these HTTP
endpoints on a timer. Once that is set up, reminders, fee/grace lifecycle,
follow-ups, and emails run automatically.

All endpoints require this header (never put the token in the URL):

```
Authorization: Bearer <CRON_SECRET_TOKEN>
```

`CRON_SECRET_TOKEN` is in your environment. Use a long random value in production.

---

## 1. The main heartbeat - every 10 to 15 minutes

Hit ONE URL:

```
GET https://<your-domain>/api/cron/tick
```

`/api/cron/tick` does both jobs in one call: it enqueues time-critical reminders
(fees due, grace ending, classes starting in the next 20 minutes, lead follow-ups,
admin grace-expired alerts) and then drains the email queue via Resend.

It is idempotent - running it every few minutes never double-sends (each reminder
has a unique key). The class-reminder window is 20 minutes, which is wider than the
15-minute cron interval on purpose, so a class can never fall in the gap between two
runs.

> You can still call `/api/cron/reminders` and `/api/cron/send` separately if you
> prefer, but `/tick` is simpler - one schedule, one URL.

### Option A - Free external pinger (recommended: cron-job.org, UptimeRobot, etc.)

1. Create a free account at https://cron-job.org
2. New cron job:
   - URL: `https://<your-domain>/api/cron/tick`
   - Schedule: every 10 minutes (`*/10 * * * *`)
   - Request method: GET
   - Add a request header: `Authorization: Bearer <CRON_SECRET_TOKEN>`
3. Save. Check the execution log after a few minutes - a healthy run returns
   HTTP 200 with a JSON body like `{"ok":true,"reminders":{...},"send":{...}}`.

### Option B - cPanel cron

cPanel -> Cron Jobs -> add, every 10 minutes:

```
*/10 * * * * curl -fsS -H "Authorization: Bearer YOUR_TOKEN" https://<your-domain>/api/cron/tick >/dev/null 2>&1
```

---

## 2. Monthly parent reports - once a month

```
GET https://<your-domain>/api/cron/monthly-reports
```

Run it on the 1st of each month (assembles each active student's month facts and
queues the report emails; the /tick heartbeat then sends them):

```
0 6 1 * * curl -fsS -H "Authorization: Bearer YOUR_TOKEN" https://<your-domain>/api/cron/monthly-reports >/dev/null 2>&1
```

## 3. Backup export - weekly

```
GET https://<your-domain>/api/cron/backup-export
```

IMPORTANT: this endpoint STREAMS a JSON dump; it does not store anything itself.
Your cron must capture the output to a file, or it backs up nothing:

```
0 2 * * 0 curl -fsS -H "Authorization: Bearer YOUR_TOKEN" https://<your-domain>/api/cron/backup-export -o ~/backups/thinkerzz-$(date +\%F).json
```

Rotate/copy those files off-server periodically.

---

## Local testing

While developing, `<your-domain>` is `http://localhost:3000`. Example:

```
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/cron/tick
```

## Notes / limits

- Email sending is capped at 100/day (Resend free tier). Failed sends retry with
  exponential backoff (1, 2, 4, 8, 16 min) up to 5 attempts, then flip to `failed`
  and show on the Email Queue screen. Nothing is dropped silently.
- WhatsApp reminders are NOT automated - only email is sent. WhatsApp in the app is
  manual `wa.me` links.
- Keep `CRON_SECRET_TOKEN` secret and strong. Anyone with it can trigger these jobs.
