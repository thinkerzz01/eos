// Email channel adapter (Resend). The queue sender calls this; features never do.
// Safe without a key: returns { ok:false } so the sender records a failure and
// retries later rather than dropping the message.
export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const from = process.env.RESEND_FROM ?? 'Thinkerzz <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      // text is kept as the plain-text fallback; html renders the branded version.
      body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) }),
    });
    if (res.ok) return { ok: true };
    const detail = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 180)}` };
  } catch (e: any) {
    return { ok: false, error: `Resend request failed: ${e?.message ?? 'unknown'}` };
  }
}
