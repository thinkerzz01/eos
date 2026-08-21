import 'server-only';

// One branded, email-safe HTML wrapper for every outbound email. Uses table layout
// + inline styles (the only thing email clients render reliably). Callers pass plain
// text (kept as the fallback) plus an optional call-to-action button.
const BRAND = '#5B47D6';
const INK = '#171A2B';
const MUTED = '#6B7185';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const WA_GREEN = '#12A150';

export function renderEmailHtml(opts: {
  heading?: string;
  bodyText: string; // plain text; blank lines -> paragraphs, single newlines -> <br>
  cta?: { label: string; url: string };
  preheader?: string; // hidden inbox preview line
  hideCtaLinkFallback?: boolean; // omit the "copy and paste this link" line under the button
  secondaryButton?: { label: string; url: string }; // outline button (e.g. Save Contact)
  whatsapp?: { number: string; label?: string }; // green "Contact us on WhatsApp" button
  footerNote?: string; // override the footer line (defaults to a copyright + auto-message notice)
}): string {
  const paras = opts.bodyText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${esc(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  const ctaButton = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:10px;background:${BRAND};">
         <a href="${opts.cta.url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(opts.cta.label)}</a>
       </td></tr></table>`
    : '';

  const ctaFallback =
    opts.cta && !opts.hideCtaLinkFallback
      ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${MUTED};">If the button does not work, copy and paste this link:<br><a href="${opts.cta.url}" style="color:${BRAND};word-break:break-all;">${esc(opts.cta.url)}</a></p>`
      : '';

  const secondary = opts.secondaryButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:2px 0 8px;"><tr><td style="border-radius:10px;border:1px solid ${BRAND};">
         <a href="${opts.secondaryButton.url}" style="display:inline-block;padding:10px 22px;font-size:14px;font-weight:700;color:${BRAND};text-decoration:none;border-radius:10px;">${esc(opts.secondaryButton.label)}</a>
       </td></tr></table>`
    : '';

  // WhatsApp "need help" button on EVERY email by default (uses the academy number
  // unless a caller passes its own). Pass whatsapp:null-equivalent is not supported;
  // it is intentionally always shown so recipients can reach us in one tap.
  const waNumber = opts.whatsapp?.number ?? process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP ?? '';
  const waDigits = waNumber.replace(/\D/g, '');
  const whatsapp = waDigits
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:2px 0 8px;"><tr><td style="border-radius:10px;background:${WA_GREEN};">
         <a href="https://wa.me/${waDigits}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(opts.whatsapp?.label ?? 'Need help? Message us on WhatsApp')}</a>
       </td></tr></table>`
    : '';

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>`
    : '';

  const heading = opts.heading
    ? `<h1 style="margin:0 0 14px;font-size:20px;font-weight:800;color:${INK};">${esc(opts.heading)}</h1>`
    : '';

  // Brand logo (dark version) on a white header on every email. Emails require an
  // absolute, publicly-reachable URL, so default to the logo served from the
  // portal domain; NEXT_PUBLIC_EMAIL_LOGO_URL can override it.
  const portalBase = (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');
  const logoUrl = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || `${portalBase}/logo-light.png`;
  const header = `<img src="${logoUrl}" alt="Thinkerzz" height="28" style="height:28px;width:auto;display:block;border:0;" />`;

  const footer = opts.footerNote ?? `© ${new Date().getFullYear()} Thinkerzz. This is an automated message, please do not reply.`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F7FB;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EBEDF3;">
      <tr><td style="background:#ffffff;padding:18px 24px;border-bottom:1px solid #EBEDF3;">${header}</td></tr>
      <tr><td style="padding:26px 24px 6px;">${heading}${paras}${ctaButton}${ctaFallback}${secondary}${whatsapp}</td></tr>
      <tr><td style="padding:16px 24px 22px;border-top:1px solid #EBEDF3;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${INK};">Thinkerzz</p>
        <p style="margin:0 0 10px;font-size:12px;color:${MUTED};">Question. Think. Achieve.</p>
        <p style="margin:0;font-size:12px;color:${MUTED};">${esc(footer)}</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}
