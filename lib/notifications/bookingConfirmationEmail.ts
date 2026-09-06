import 'server-only';

// Premium, email-safe Thinkerzz demo-booking confirmation email. Table layout +
// inline styles (the only thing email clients render reliably), one <style> block
// with @media rules for mobile stacking (progressive enhancement - it degrades to
// a readable single/double column when a client ignores it). No JS, no web fonts,
// no animation dependency: the celebration is a static branded badge so the email
// looks premium even with images blocked.
//
// Every field is dynamic. Teacher + Google Meet are OPTIONAL: at booking time the
// demo has neither, so the template shows "Teacher will be confirmed" and routes
// joining via WhatsApp; once the demo is assigned (teacher + Meet link exist) the
// SAME template renders the Join button and "Teacher assigned".

const BRAND = '#5B47D6';
const BRAND_DK = '#4F3DC7';
const INK = '#171A2B';
const MUTED = '#6B7185';
const LAV = '#F4F2FD'; // soft lavender card background
const LINE = '#EBEDF3';
const WA = '#12A150';
const WA_DK = '#0E8A44';

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface BookingConfirmationData {
  studentName: string;
  parentName?: string;
  bookingRef: string;
  dateLabel: string; // "Sunday, 6 September 2026"
  timeLabel: string; // "5:00 PM – 6:00 PM (PKT)"
  subject?: string;
  program?: string;
  teacherName?: string; // present once the demo is assigned
  durationLabel?: string; // "1 Hour"
  meetUrl?: string; // present once the demo is assigned
  whatsappNumber?: string; // display form, e.g. "0320 761 3778"
  whatsappUrl?: string; // wa.me deep link
  googleCalUrl?: string;
  outlookCalUrl?: string;
  bookAnotherUrl?: string;
  homeUrl?: string;
  supportEmail?: string;
}

// A labelled detail cell (icon emoji + label + value) for the two-column card.
function detailCell(emoji: string, label: string, value: string): string {
  if (!value) return '';
  return `<td class="stack" width="50%" valign="top" style="padding:10px 8px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" style="padding-right:10px;font-size:18px;line-height:1;">${emoji}</td>
      <td valign="top">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};font-weight:700;">${esc(label)}</div>
        <div style="font-size:15px;color:${INK};font-weight:700;margin-top:2px;">${esc(value)}</div>
      </td>
    </tr></table>
  </td>`;
}

function stepRow(num: string, done: boolean, title: string, body: string, last: boolean): string {
  const badge = done
    ? `<td width="28" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:${BRAND};color:#fff;text-align:center;line-height:28px;font-size:14px;font-weight:700;">&#10003;</div></td>`
    : `<td width="28" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:#fff;border:1px solid #D7D9E4;color:${MUTED};text-align:center;line-height:26px;font-size:13px;font-weight:700;">${num}</div></td>`;
  return `<tr>${badge}
    <td valign="top" style="padding:0 0 ${last ? '0' : '14px'} 12px;">
      <div style="font-size:14px;color:${INK};font-weight:700;">${esc(title)}</div>
      <div style="font-size:13px;color:${MUTED};line-height:1.5;margin-top:2px;">${esc(body)}</div>
    </td></tr>`;
}

export function renderBookingConfirmationEmail(data: BookingConfirmationData): {
  subject: string;
  html: string;
  text: string;
} {
  const portalBase = (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://portal.thinkerzz.com').replace(/\/$/, '');
  const logoUrl = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || `${portalBase}/logo-light.png`;
  const supportEmail = data.supportEmail || process.env.NEXT_PUBLIC_ACADEMY_EMAIL || 'info@thinkerzz.com';
  const hasMeet = !!data.meetUrl;
  const hasTeacher = !!(data.teacherName && data.teacherName.trim());
  const greet = data.parentName?.trim() || 'there';

  // ---- Booking details grid (two cells per row; empty fields drop out) --------
  const cells = [
    detailCell('&#128197;', 'Date', data.dateLabel),
    detailCell('&#128336;', 'Time', data.timeLabel),
    detailCell('&#128214;', 'Subject', data.subject || ''),
    hasTeacher ? detailCell('&#128100;', 'Your Teacher', data.teacherName as string) : '',
    detailCell('&#127891;', 'Program', data.program || ''),
    detailCell('&#8987;', 'Duration', data.durationLabel || '1 Hour'),
  ].filter(Boolean);
  let detailRows = '';
  for (let i = 0; i < cells.length; i += 2) {
    detailRows += `<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`;
  }

  // ---- Primary actions --------------------------------------------------------
  const btn = (label: string, url: string, bg: string, color = '#ffffff', border?: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
       <td align="center" style="border-radius:12px;background:${bg};${border ? `border:1px solid ${border};` : ''}">
         <a href="${url}" style="display:block;padding:13px 22px;font-size:14px;font-weight:700;color:${color};text-decoration:none;border-radius:12px;">${label}</a>
       </td></tr></table>`;

  const joinBtn = hasMeet
    ? `<td class="stack" width="34%" valign="top" style="padding:4px;">${btn('&#127909;&nbsp; Join Google Meet &rarr;', data.meetUrl as string, BRAND)}</td>`
    : '';
  const waBtn = data.whatsappUrl
    ? `<td class="stack" width="${hasMeet ? '33%' : '50%'}" valign="top" style="padding:4px;">${btn('&#128172;&nbsp; Chat on WhatsApp &rarr;', data.whatsappUrl, '#ffffff', WA, '#B7E4C7')}</td>`
    : '';
  const calBtn = data.googleCalUrl
    ? `<td class="stack" width="${hasMeet ? '33%' : '50%'}" valign="top" style="padding:4px;">${btn('&#128197;&nbsp; Add to Calendar', data.googleCalUrl, '#ffffff', INK, '#D7D9E4')}</td>`
    : '';

  // ---- WhatsApp card ----------------------------------------------------------
  const waCard = data.whatsappNumber
    ? `<tr><td style="padding:6px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF7EF;border:1px solid #C7EBD5;border-radius:16px;">
          <tr><td style="padding:18px 20px;">
            <div style="font-size:15px;font-weight:800;color:${WA_DK};">&#128172;&nbsp; We&rsquo;ll also send your class details on WhatsApp</div>
            <div style="font-size:13px;color:${INK};line-height:1.6;margin-top:6px;">Your Google Meet link and important class updates will be sent to <strong>${esc(data.whatsappNumber)}</strong>.</div>
            ${data.whatsappUrl ? `<div style="margin-top:12px;">${btn('&#128172;&nbsp; Open WhatsApp &rarr;', data.whatsappUrl, WA)}</div>` : ''}
          </td></tr>
        </table>
      </td></tr>`
    : '';

  // ---- What's next (step 2 depends on teacher assignment) ---------------------
  const nextSteps = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${stepRow('1', true, 'Booking Confirmed', 'Your demo has been successfully scheduled.', false)}
    ${hasTeacher
      ? stepRow('2', true, 'Teacher Assigned', 'Your teacher is ready to meet you.', false)
      : stepRow('2', false, 'Teacher Confirmation', 'Your assigned teacher will conduct the session.', false)}
    ${stepRow('3', false, 'Join the Class', 'Use the Google Meet link at your scheduled time.', true)}
  </table>`;

  // ---- Secondary actions ------------------------------------------------------
  const secondary =
    data.bookAnotherUrl || data.homeUrl
      ? `<tr><td align="center" style="padding:6px 28px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${data.bookAnotherUrl ? `<td style="padding:4px;">${btn('Book Another Demo', data.bookAnotherUrl, '#ffffff', BRAND, '#D9D3F5')}</td>` : ''}
            ${data.homeUrl ? `<td style="padding:4px;">${btn('Back to Thinkerzz', data.homeUrl, '#ffffff', MUTED, '#E1E3EC')}</td>` : ''}
          </tr></table>
        </td></tr>`
      : '';

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<style>
  @media only screen and (max-width:600px){
    .stack{display:block!important;width:100%!important;padding:4px 0!important;}
    .container{width:100%!important;}
    .p-side{padding-left:18px!important;padding-right:18px!important;}
    .h1{font-size:26px!important;}
    .stud{font-size:24px!important;}
  }
</style></head>
<body style="margin:0;padding:0;background:#F1F0F8;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Thinkerzz free demo class for ${esc(data.studentName)} is confirmed &mdash; ${esc(data.dateLabel)}, ${esc(data.timeLabel)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F0F8;padding:24px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="680" class="container" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${LINE};">

      <!-- HEADER -->
      <tr><td class="p-side" style="padding:20px 28px;border-bottom:1px solid ${LINE};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle"><img src="${logoUrl}" alt="Thinkerzz" height="30" style="height:30px;width:auto;display:block;border:0;"><div style="font-size:11px;color:${MUTED};margin-top:4px;">Question. Think. Achieve.</div></td>
          <td valign="middle" align="right" style="font-size:11px;color:${MUTED};line-height:1.5;">Student Learning<br>For A Brighter Tomorrow</td>
        </tr></table>
      </td></tr>

      <!-- HERO -->
      <tr><td class="p-side" style="padding:26px 28px 8px;">
        <span style="display:inline-block;background:#EAF7EF;border:1px solid #C7EBD5;color:${WA_DK};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">&#127881; Demo Class Confirmed</span>
        <h1 class="h1" style="margin:14px 0 6px;font-size:30px;line-height:1.15;font-weight:800;color:${INK};">Your Free Demo Class<br>Is <span style="color:${BRAND};">Confirmed!</span></h1>
        <p style="margin:8px 0 2px;font-size:15px;color:${INK};font-weight:700;">Thank you, ${esc(greet)}!</p>
        <p style="margin:2px 0 0;font-size:14px;color:${MUTED};line-height:1.6;">Your free demo for <strong style="color:${INK};">${esc(data.studentName)}</strong> has been successfully booked. We&rsquo;re excited to meet you!</p>
      </td></tr>

      <!-- BOOKING CARD -->
      <tr><td class="p-side" style="padding:18px 28px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LAV};border:1px solid #E4DFFA;border-radius:18px;">
          <tr><td style="padding:18px 18px 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td valign="top">
                <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND};font-weight:800;">Free Demo Class</div>
                <div class="stud" style="font-size:26px;font-weight:800;color:${INK};margin-top:2px;">${esc(data.studentName)}</div>
              </td>
              <td valign="top" align="right">
                <div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};font-weight:700;">Booking Reference</div>
                <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:800;color:${INK};margin-top:3px;">${esc(data.bookingRef)}</div>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:2px 10px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
          </td></tr>
        </table>
      </td></tr>

      <!-- PRIMARY ACTIONS -->
      <tr><td class="p-side" style="padding:14px 24px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${joinBtn}${waBtn}${calBtn}</tr></table>
        ${hasMeet ? `<p style="margin:8px 4px 0;font-size:12px;color:${MUTED};text-align:center;">Meeting link: <a href="${data.meetUrl}" style="color:${BRAND};">${esc((data.meetUrl as string).replace(/^https?:\/\//, ''))}</a></p>` : `<p style="margin:8px 4px 0;font-size:12px;color:${MUTED};text-align:center;">Your Google Meet link will be shared on WhatsApp before the class.</p>`}
      </td></tr>

      ${waCard}

      <!-- BEFORE YOUR DEMO + NEXT STEPS -->
      <tr><td class="p-side" style="padding:18px 28px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="stack" width="50%" valign="top" style="padding-right:8px;">
            <div style="font-size:15px;font-weight:800;color:${INK};margin-bottom:8px;">Before Your Demo</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${INK};line-height:1.5;">
              <tr><td valign="top" style="padding:4px 0;"><strong style="color:${BRAND};">01</strong>&nbsp;&nbsp;Join at least 5 minutes before the scheduled time.</td></tr>
              <tr><td valign="top" style="padding:4px 0;"><strong style="color:${BRAND};">02</strong>&nbsp;&nbsp;Keep your books and study materials ready.</td></tr>
              <tr><td valign="top" style="padding:4px 0;"><strong style="color:${BRAND};">03</strong>&nbsp;&nbsp;Make sure your microphone and camera are working.</td></tr>
              <tr><td valign="top" style="padding:4px 0;"><strong style="color:${BRAND};">04</strong>&nbsp;&nbsp;If you cannot attend, please inform Thinkerzz in advance.</td></tr>
            </table>
          </td>
          <td class="stack" width="50%" valign="top" style="padding-left:8px;">
            <div style="font-size:15px;font-weight:800;color:${INK};margin-bottom:8px;">Your Next Steps</div>
            ${nextSteps}
          </td>
        </tr></table>
      </td></tr>

      ${secondary}

      <!-- SUPPORT -->
      <tr><td class="p-side" style="padding:14px 28px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;border:1px solid ${LINE};border-radius:16px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:14px;font-weight:800;color:${INK};">Need help?</div>
            <div style="font-size:13px;color:${MUTED};margin-top:2px;">Our team is here to assist you.</div>
            <div style="font-size:13px;color:${INK};margin-top:8px;">
              ${data.whatsappNumber ? `&#128172;&nbsp; WhatsApp: <strong>${esc(data.whatsappNumber)}</strong>&nbsp;&nbsp;` : ''}
              &#9993;&nbsp; <a href="mailto:${esc(supportEmail)}" style="color:${BRAND};">${esc(supportEmail)}</a>
            </div>
          </td></tr>
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td class="p-side" style="padding:18px 28px 24px;border-top:1px solid ${LINE};text-align:center;">
        <div style="font-size:16px;font-weight:800;color:${BRAND};">Thinkerzz</div>
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">Question. Think. Achieve.</div>
        <div style="font-size:12px;color:${INK};margin-top:10px;">Thank you for choosing Thinkerzz. Together, we build brighter futures. &#128156;</div>
        <div style="font-size:11px;color:${MUTED};margin-top:12px;line-height:1.6;">This email was sent because a free demo class was booked through Thinkerzz.<br>If you did not make this booking, please contact our support team.</div>
      </td></tr>

    </table>
  </td></tr>
</table></body></html>`;

  // Plain-text fallback (some clients / accessibility).
  const text = [
    `Your Thinkerzz free demo class is confirmed!`,
    ``,
    `Thank you, ${greet}! Your free demo for ${data.studentName} has been booked.`,
    ``,
    `Booking reference: ${data.bookingRef}`,
    `Date: ${data.dateLabel}`,
    `Time: ${data.timeLabel}`,
    data.subject ? `Subject: ${data.subject}` : '',
    data.program ? `Program: ${data.program}` : '',
    hasTeacher ? `Teacher: ${data.teacherName}` : `Teacher: will be confirmed`,
    `Duration: ${data.durationLabel || '1 Hour'}`,
    ``,
    hasMeet ? `Join Google Meet: ${data.meetUrl}` : `Your Google Meet link will be shared on WhatsApp before the class.`,
    data.whatsappNumber ? `We'll also send details on WhatsApp: ${data.whatsappNumber}` : '',
    ``,
    `Need help? Email ${supportEmail}${data.whatsappNumber ? ` or WhatsApp ${data.whatsappNumber}` : ''}.`,
    ``,
    `Thinkerzz - Question. Think. Achieve.`,
  ].filter((l) => l !== '').join('\n');

  const subject = `Demo Confirmed: ${data.studentName} - ${data.dateLabel}`;

  return { subject, html, text };
}
