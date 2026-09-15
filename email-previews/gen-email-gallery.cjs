/* Standalone email-gallery generator. Ports the exact render functions from the
   app (emailLayout.renderEmailHtml, templates catalogue, bookingConfirmationEmail,
   and the auth email calls) with sample data so the gallery matches what is sent.
   No project imports (avoids the 'server-only' guard). */

const fs = require('fs');
const path = require('path');

// ---- Env defaults used by the render functions -----------------------------
const PORTAL = 'https://portal.thinkerzz.com';
const LOGO = PORTAL + '/logo-light.png';
const WA_NUMBER = '0320 761 3778';
const SITE = 'https://portal.thinkerzz.com';

// ============================================================================
// PORT of lib/notifications/emailLayout.ts renderEmailHtml (exact)
// ============================================================================
const BRAND = '#5B47D6';
const INK = '#171A2B';
const MUTED = '#6B7185';
const WA_GREEN = '#12A150';
function esc(s) { return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderEmailHtml(opts) {
  const paras = opts.bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const ctaButton = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:10px;background:${BRAND};">
         <a href="${opts.cta.url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(opts.cta.label)}</a>
       </td></tr></table>`
    : '';
  const ctaFallback = opts.cta && !opts.hideCtaLinkFallback
    ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${MUTED};">If the button does not work, copy and paste this link:<br><a href="${opts.cta.url}" style="color:${BRAND};word-break:break-all;">${esc(opts.cta.url)}</a></p>`
    : '';
  const secondary = opts.secondaryButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:2px 0 8px;"><tr><td style="border-radius:10px;border:1px solid ${BRAND};">
         <a href="${opts.secondaryButton.url}" style="display:inline-block;padding:10px 22px;font-size:14px;font-weight:700;color:${BRAND};text-decoration:none;border-radius:10px;">${esc(opts.secondaryButton.label)}</a>
       </td></tr></table>`
    : '';
  const waNumber = opts.whatsapp?.number ?? WA_NUMBER ?? '';
  const waDigits = waNumber.replace(/\D/g, '');
  const whatsapp = waDigits
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:2px 0 8px;"><tr><td style="border-radius:10px;background:${WA_GREEN};">
         <a href="https://wa.me/${waDigits}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(opts.whatsapp?.label ?? 'Need help? Message us on WhatsApp')}</a>
       </td></tr></table>`
    : '';
  const preheader = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>` : '';
  const heading = opts.heading ? `<h1 style="margin:0 0 14px;font-size:20px;font-weight:800;color:${INK};">${esc(opts.heading)}</h1>` : '';
  const header = `<img src="${LOGO}" alt="Thinkerzz" height="28" style="height:28px;width:auto;display:block;border:0;" />`;
  const footer = opts.footerNote ?? `© 2022 - ${new Date().getFullYear()} Thinkerzz. This is an automated message, please do not reply.`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F7FB;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #EBEDF3;">
      <tr><td style="background:#ffffff;padding:18px 24px;border-bottom:1px solid #EBEDF3;">${header}</td></tr>
      <tr><td style="padding:26px 24px 6px;">${heading}${paras}${ctaButton}${ctaFallback}${secondary}${whatsapp}</td></tr>
      <tr><td style="padding:16px 24px 22px;border-top:1px solid #EBEDF3;">
        <p style="margin:0;font-size:12px;color:${MUTED};">${esc(footer)}</p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ============================================================================
// PORT of lib/notifications/templates.ts (subjects/bodies + render)
// ============================================================================
function renderTemplate(t, vars) { return t.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? ''); }

const TEMPLATES = {
  class_reminder: { subject: 'Class Reminder For {{student_name}}', body: 'Assalam o Alaikum {{parent_name}},\n\nWe hope you are well. This is a friendly reminder that {{student_name}} has a {{class_subject}} class at {{class_time}}. Please make sure {{pronoun}} joins on time.\n\nWarm regards,\nThinkerzz', cta: { label: 'Join Your Class', useMeet: true, path: '/schedule' } },
  class_rescheduled: { subject: 'Class Rescheduled For {{student_name}}', body: "Assalam o Alaikum {{parent_name}},\n\nPlease note that {{student_name}}'s {{class_subject}} class has been rescheduled to {{class_time}}.\n\nPlease make sure {{pronoun}} joins at the new time.\n\nWe apologise for the change and appreciate your understanding.\n\nRegards,\nThinkerzz", cta: { label: 'View Your Classes', useMeet: true, path: '/schedule' } },
  fee_due: { subject: 'Fee Reminder For {{student_name}}', body: 'Assalam o Alaikum {{parent_name}},\n\nThis is a reminder that the fee for {{student_name}} is due on {{due_date}}.\n\nOnce paid, you can share the payment screenshot with us on WhatsApp or upload it through your portal.\n\nThank you.\n\nRegards,\nThinkerzz', cta: { label: 'View & Pay Voucher', path: '/fees' } },
  grace_ending: { subject: "A Quick Note About {{student_name}}'s Fee", body: "Assalam o Alaikum {{parent_name}},\n\nA quick reminder that the grace period for {{student_name}}'s fee ends on {{grace_deadline}}.\n\nPlease complete the payment before the deadline so {{student_name}}'s classes can continue without interruption.\n\nIf you have already made the payment, please disregard this message.\n\nRegards,\nThinkerzz", cta: { label: 'Pay Now', path: '/fees' } },
  payment_received: { subject: 'Payment Received For {{student_name}}', body: 'Assalam o Alaikum {{parent_name}},\n\nYour payment for {{student_name}} has been received successfully.\n\nThe payment receipt is now available in your Thinkerzz portal.\n\nThank you for choosing Thinkerzz.\n\nRegards,\nThinkerzz', cta: { label: 'View Receipt', path: '/fees' } },
  monthly_report: { subject: 'Monthly Progress Report For {{student_name}}', body: "Assalam o Alaikum {{parent_name}},\n\n{{body}}\n\nYou can view the complete progress report and other academic details in your Thinkerzz portal.\n\nThank you for being part of {{student_name}}'s learning journey.\n\nRegards,\nThinkerzz", cta: { label: 'Open Your Portal', path: '/login' } },
  follow_up: { subject: 'Following Up About {{student_name}}', body: 'Assalam o Alaikum {{parent_name}},\n\nWe are following up regarding {{student_name}}.\n\nIf you have any questions or need help with anything, please feel free to contact us. We will be happy to assist.\n\nRegards,\nThinkerzz' },
  announcement: { subject: '{{class_subject}}', body: '{{body}}', cta: { label: 'View in Portal', path: '/announcements' } },
  grace_expired_admin: { subject: 'Fee Decision Needed For {{student_name}}', body: 'Admin Note\n\nThe grace period for voucher {{voucher_no}} for {{student_name}} ended on {{grace_deadline}}, and the voucher is still unpaid.\n\nPlease review the voucher in the Fee Vouchers section and select one of the available actions: Stop, Extend, or Mark Paid.\n\nRegards,\nThinkerzz', cta: { label: 'Open Fee Vouchers', path: '/vouchers' } },
};

const VARS = {
  student_name: 'Ayesha Khan', parent_name: 'Mr. Khan', voucher_no: 'TZ-000142',
  due_date: '20 September 2026', grace_deadline: '23 September 2026',
  class_subject: 'Physics', class_time: 'Sunday, 21 September 2026, 5:00 PM',
  amount: '5000', date: 'Sunday, 21 September 2026', time: '5:00 PM',
  subject: 'Physics', duration: '1 Hour',
  pronoun: 'she', pronoun_object: 'her', pronoun_possessive: 'her',
  body: "Here is Ayesha's progress summary for this month.\n\nAttendance: 96 percent\nHomework Completion: 88 percent\nTests Conducted: 3\nTopics Covered: Kinematics, Newton's Laws, Work & Energy\nAssessed Grade Trend: Improving (B to A)",
};

function renderQueueEmail(type) {
  const tpl = TEMPLATES[type];
  const subject = renderTemplate(tpl.subject, VARS);
  const body = renderTemplate(tpl.body, VARS);
  let cta;
  if (tpl.cta) {
    const meet = 'https://meet.google.com/abc-defg-hij';
    const url = tpl.cta.useMeet && meet ? meet : tpl.cta.path ? `${PORTAL}${tpl.cta.path}` : '';
    if (url) cta = { label: tpl.cta.label, url };
  }
  const secondaryButton = (type === 'class_reminder' || type === 'class_rescheduled')
    ? { label: 'Add to Calendar', url: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Thinkerzz+Physics+Class' }
    : undefined;
  const html = renderEmailHtml({ bodyText: body, preheader: subject, cta, hideCtaLinkFallback: true, secondaryButton });
  return { subject, html };
}

// ---- Auth emails (provision welcome, reset, test) --------------------------
function welcomeTeacher() {
  const intro = 'You have been added as a teacher to our portal. Please set your password to access your account and view your class schedule, students, and other teaching details.';
  const saveContactNote = 'One Small Tip: Save the Thinkerzz contact details below so your class invitations are recognised and can be added to your Google Calendar easily.';
  const html = renderEmailHtml({
    heading: 'Welcome To Thinkerzz, Sir Ahmed Raza',
    preheader: 'Set your password to access your Thinkerzz portal.',
    bodyText: `Assalam o Alaikum,\n\n${intro}\n\nOnce your password is set, you can sign in at ${PORTAL}/login using this email address.\n\n${saveContactNote}\n\nRegards,\nThinkerzz`,
    cta: { label: 'Set Your Password', url: `${SITE}/set-password?token=sample` },
    hideCtaLinkFallback: true,
    secondaryButton: { label: 'Save Thinkerzz Contact', url: `${SITE}/api/contact-card` },
    whatsapp: { number: WA_NUMBER, label: 'Need help? Message us on WhatsApp' },
  });
  return { subject: 'Welcome To Thinkerzz | Set Your Portal Password', html };
}
function welcomeStudent() {
  const intro = 'You have been enrolled as a student. Please set your password to access your student portal, where you can view your classes, schedule, fees, and other academic details.';
  const saveContactNote = 'One Small Tip: Save the Thinkerzz contact details below so your class invitations are recognised and can be added to your Google Calendar easily.';
  const html = renderEmailHtml({
    heading: 'Welcome To Thinkerzz, Ayesha Khan',
    preheader: 'Set your password to access your Thinkerzz portal.',
    bodyText: `Assalam o Alaikum,\n\n${intro}\n\nOnce your password is set, you can sign in at ${PORTAL}/login using this email address.\n\n${saveContactNote}\n\nRegards,\nThinkerzz`,
    cta: { label: 'Set Your Password', url: `${SITE}/set-password?token=sample` },
    hideCtaLinkFallback: true,
    secondaryButton: { label: 'Save Thinkerzz Contact', url: `${SITE}/api/contact-card` },
    whatsapp: { number: WA_NUMBER, label: 'Need help? Message us on WhatsApp' },
  });
  return { subject: 'Welcome To Thinkerzz | Set Your Portal Password', html };
}
function resetEmail() {
  const email = 'ayesha.khan@example.com';
  const html = renderEmailHtml({
    heading: 'Reset Your Password',
    preheader: 'Set a new password for your Thinkerzz account.',
    bodyText: `A password reset was requested for your Thinkerzz account.\n\nUsername: ${email}\n\nIf you made this request, use the button below to set a new password.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nRegards,\nThinkerzz`,
    cta: { label: 'Set a new password', url: `${SITE}/set-password?token=sample` },
  });
  return { subject: 'Reset Your Thinkerzz Password', html };
}
function testEmail() {
  const from = 'Thinkerzz <no-reply@portal.thinkerzz.com>';
  const html = renderEmailHtml({
    heading: 'Test Email',
    preheader: 'Confirming Thinkerzz email delivery.',
    bodyText: `This is a test email from Thinkerzz EOS.\n\nFrom: ${from}\n\nIf you received this message, email delivery is working correctly.\n\nThinkerzz EOS`,
  });
  return { subject: 'Thinkerzz EOS | Test Email', html };
}

// ============================================================================
// PORT of lib/notifications/bookingConfirmationEmail.ts (exact)
// ============================================================================
const B_BRAND = '#5B47D6', B_INK = '#171A2B', B_MUTED = '#6B7185', B_LAV = '#F4F2FD', B_LINE = '#EBEDF3', B_WA = '#12A150', B_WA_DK = '#0E8A44';
function besc(s) { return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function detailCell(emoji, label, value) {
  if (!value) return '';
  return `<td class="stack" width="50%" valign="top" style="padding:10px 8px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="top" style="padding-right:10px;font-size:18px;line-height:1;">${emoji}</td><td valign="top"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${B_MUTED};font-weight:700;">${besc(label)}</div><div style="font-size:15px;color:${B_INK};font-weight:700;margin-top:2px;">${besc(value)}</div></td></tr></table></td>`;
}
function stepRow(num, done, title, body, last) {
  const badge = done
    ? `<td width="28" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:${B_BRAND};color:#fff;text-align:center;line-height:28px;font-size:14px;font-weight:700;">&#10003;</div></td>`
    : `<td width="28" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:#fff;border:1px solid #D7D9E4;color:${B_MUTED};text-align:center;line-height:26px;font-size:13px;font-weight:700;">${num}</div></td>`;
  return `<tr>${badge}<td valign="top" style="padding:0 0 ${last ? '0' : '14px'} 12px;"><div style="font-size:14px;color:${B_INK};font-weight:700;">${besc(title)}</div><div style="font-size:13px;color:${B_MUTED};line-height:1.5;margin-top:2px;">${besc(body)}</div></td></tr>`;
}
function renderBookingConfirmationEmail(data) {
  const logoUrl = LOGO;
  const supportEmail = data.supportEmail || 'info@thinkerzz.com';
  const hasMeet = !!data.meetUrl;
  const hasTeacher = !!(data.teacherName && data.teacherName.trim());
  const greet = data.parentName?.trim() || 'there';
  const cells = [
    detailCell('&#128197;', 'Date', data.dateLabel),
    detailCell('&#128336;', 'Time', data.timeLabel),
    detailCell('&#128214;', 'Subject', data.subject || ''),
    hasTeacher ? detailCell('&#128100;', 'Your Teacher', data.teacherName) : '',
    detailCell('&#127891;', 'Program', data.program || ''),
    detailCell('&#8987;', 'Duration', data.durationLabel || '1 Hour'),
  ].filter(Boolean);
  let detailRows = '';
  for (let i = 0; i < cells.length; i += 2) detailRows += `<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`;
  const btn = (label, url, bg, color = '#ffffff', border) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="border-radius:12px;background:${bg};${border ? `border:1px solid ${border};` : ''}"><a href="${url}" style="display:block;padding:13px 22px;font-size:14px;font-weight:700;color:${color};text-decoration:none;border-radius:12px;">${label}</a></td></tr></table>`;
  const joinBtn = hasMeet ? `<td class="stack" width="34%" valign="top" style="padding:4px;">${btn('&#127909;&nbsp; Join Google Meet &rarr;', data.meetUrl, B_BRAND)}</td>` : '';
  const waBtn = data.whatsappUrl ? `<td class="stack" width="${hasMeet ? '33%' : '50%'}" valign="top" style="padding:4px;">${btn('&#128172;&nbsp; Chat on WhatsApp &rarr;', data.whatsappUrl, '#ffffff', B_WA, '#B7E4C7')}</td>` : '';
  const calBtn = data.googleCalUrl ? `<td class="stack" width="${hasMeet ? '33%' : '50%'}" valign="top" style="padding:4px;">${btn('&#128197;&nbsp; Add to Calendar', data.googleCalUrl, '#ffffff', B_INK, '#D7D9E4')}</td>` : '';
  const waCard = data.whatsappNumber ? `<tr><td style="padding:6px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAF7EF;border:1px solid #C7EBD5;border-radius:16px;"><tr><td style="padding:18px 20px;"><div style="font-size:15px;font-weight:800;color:${B_WA_DK};">&#128172;&nbsp; We&rsquo;ll also send your class details on WhatsApp</div><div style="font-size:13px;color:${B_INK};line-height:1.6;margin-top:6px;">Your Google Meet link and important class updates will be sent to <strong>${besc(data.whatsappNumber)}</strong>.</div>${data.whatsappUrl ? `<div style="margin-top:12px;">${btn('&#128172;&nbsp; Open WhatsApp &rarr;', data.whatsappUrl, B_WA)}</div>` : ''}</td></tr></table></td></tr>` : '';
  const nextSteps = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stepRow('1', true, 'Booking Confirmed', 'Your demo has been successfully scheduled.', false)}${hasTeacher ? stepRow('2', true, 'Teacher Assigned', 'Your teacher is ready to meet you.', false) : stepRow('2', false, 'Teacher Confirmation', 'Your assigned teacher will conduct the session.', false)}${stepRow('3', false, 'Join the Class', 'Use the Google Meet link at your scheduled time.', true)}</table>`;
  const secondary = data.bookAnotherUrl || data.homeUrl ? `<tr><td align="center" style="padding:6px 28px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${data.bookAnotherUrl ? `<td style="padding:4px;">${btn('Book Another Demo', data.bookAnotherUrl, '#ffffff', B_BRAND, '#D9D3F5')}</td>` : ''}${data.homeUrl ? `<td style="padding:4px;">${btn('Back to Thinkerzz', data.homeUrl, '#ffffff', B_MUTED, '#E1E3EC')}</td>` : ''}</tr></table></td></tr>` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:600px){.stack{display:block!important;width:100%!important;padding:4px 0!important;}.container{width:100%!important;}.p-side{padding-left:18px!important;padding-right:18px!important;}.h1{font-size:26px!important;}.stud{font-size:24px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F0F8;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Thinkerzz free demo class for ${besc(data.studentName)} is confirmed &mdash; ${besc(data.dateLabel)}, ${besc(data.timeLabel)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F0F8;padding:24px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center"><table role="presentation" width="680" class="container" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${B_LINE};">
<tr><td class="p-side" style="padding:20px 28px;border-bottom:1px solid ${B_LINE};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="middle"><img src="${logoUrl}" alt="Thinkerzz" height="30" style="height:30px;width:auto;display:block;border:0;"><div style="font-size:11px;color:${B_MUTED};margin-top:4px;">Question. Think. Achieve.</div></td><td valign="middle" align="right" style="font-size:11px;color:${B_MUTED};line-height:1.5;">Student Learning<br>For A Brighter Tomorrow</td></tr></table></td></tr>
<tr><td class="p-side" style="padding:26px 28px 8px;"><span style="display:inline-block;background:#EAF7EF;border:1px solid #C7EBD5;color:${B_WA_DK};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">&#127881; Demo Class Confirmed</span><h1 class="h1" style="margin:14px 0 6px;font-size:30px;line-height:1.15;font-weight:800;color:${B_INK};">Your Free Demo Class<br>Is <span style="color:${B_BRAND};">Confirmed!</span></h1><p style="margin:8px 0 2px;font-size:15px;color:${B_INK};font-weight:700;">Thank you, ${besc(greet)}!</p><p style="margin:2px 0 0;font-size:14px;color:${B_MUTED};line-height:1.6;">Your free demo for <strong style="color:${B_INK};">${besc(data.studentName)}</strong> has been successfully booked. We&rsquo;re excited to meet you!</p></td></tr>
<tr><td class="p-side" style="padding:18px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B_LAV};border:1px solid #E4DFFA;border-radius:18px;"><tr><td style="padding:18px 18px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${B_BRAND};font-weight:800;">Free Demo Class</div><div class="stud" style="font-size:26px;font-weight:800;color:${B_INK};margin-top:2px;">${besc(data.studentName)}</div></td><td valign="top" align="right"><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${B_MUTED};font-weight:700;">Booking Reference</div><div style="font-family:'Courier New',monospace;font-size:18px;font-weight:800;color:${B_INK};margin-top:3px;">${besc(data.bookingRef)}</div></td></tr></table></td></tr><tr><td style="padding:2px 10px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table></td></tr></table></td></tr>
<tr><td class="p-side" style="padding:14px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${joinBtn}${waBtn}${calBtn}</tr></table>${hasMeet ? `<p style="margin:8px 4px 0;font-size:12px;color:${B_MUTED};text-align:center;">Meeting link: <a href="${data.meetUrl}" style="color:${B_BRAND};">${besc(data.meetUrl.replace(/^https?:\/\//, ''))}</a></p>` : `<p style="margin:8px 4px 0;font-size:12px;color:${B_MUTED};text-align:center;">Your Google Meet link will be shared on WhatsApp before the class.</p>`}</td></tr>
${waCard}
<tr><td class="p-side" style="padding:18px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="stack" width="50%" valign="top" style="padding-right:8px;"><div style="font-size:15px;font-weight:800;color:${B_INK};margin-bottom:8px;">Before Your Demo</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${B_INK};line-height:1.5;"><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">01</strong>&nbsp;&nbsp;Join at least 5 minutes before the scheduled time.</td></tr><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">02</strong>&nbsp;&nbsp;Keep your books and study materials ready.</td></tr><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">03</strong>&nbsp;&nbsp;Make sure your microphone and camera are working.</td></tr><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">04</strong>&nbsp;&nbsp;If you cannot attend, please inform Thinkerzz in advance.</td></tr></table></td><td class="stack" width="50%" valign="top" style="padding-left:8px;"><div style="font-size:15px;font-weight:800;color:${B_INK};margin-bottom:8px;">Your Next Steps</div>${nextSteps}</td></tr></table></td></tr>
${secondary}
<tr><td class="p-side" style="padding:14px 28px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;border:1px solid ${B_LINE};border-radius:16px;"><tr><td style="padding:16px 18px;"><div style="font-size:14px;font-weight:800;color:${B_INK};">Need help?</div><div style="font-size:13px;color:${B_MUTED};margin-top:2px;">Our team is here to assist you.</div><div style="font-size:13px;color:${B_INK};margin-top:8px;">${data.whatsappNumber ? `&#128172;&nbsp; WhatsApp: <strong>${besc(data.whatsappNumber)}</strong>&nbsp;&nbsp;` : ''}&#9993;&nbsp; <a href="mailto:${besc(supportEmail)}" style="color:${B_BRAND};">${besc(supportEmail)}</a></div></td></tr></table></td></tr>
<tr><td class="p-side" style="padding:18px 28px 24px;border-top:1px solid ${B_LINE};text-align:center;"><div style="font-size:12px;color:${B_INK};">Thank you for choosing Thinkerzz. Together, we build brighter futures. &#128156;</div><div style="font-size:11px;color:${B_MUTED};margin-top:12px;line-height:1.6;">This email was sent because a free demo class was booked through Thinkerzz.<br>If you did not make this booking, please contact our support team.</div></td></tr>
</table></td></tr></table></body></html>`;
  const subject = `Demo Confirmed: ${data.studentName} - ${data.dateLabel}`;
  return { subject, html };
}

// PORT of renderTeacherDemoEmail (bookingConfirmationEmail.ts)
function renderTeacherDemoEmail(data) {
  const logoUrl = LOGO;
  const supportEmail = data.supportEmail || 'info@thinkerzz.com';
  const hasMeet = !!data.meetUrl;
  const teacher = data.teacherName?.trim() || 'Teacher';
  const cells = [
    detailCell('&#128100;', 'Student', data.studentName),
    detailCell('&#128197;', 'Date', data.dateLabel),
    detailCell('&#128336;', 'Time', data.timeLabel),
    detailCell('&#128214;', 'Subject', data.subject || ''),
    detailCell('&#127891;', 'Program', data.program || ''),
    detailCell('&#8987;', 'Duration', data.durationLabel || '1 Hour'),
  ].filter(Boolean);
  let detailRows = '';
  for (let i = 0; i < cells.length; i += 2) detailRows += `<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`;
  const btn = (label, url, bg, color = '#ffffff', border) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="border-radius:12px;background:${bg};${border ? `border:1px solid ${border};` : ''}"><a href="${url}" style="display:block;padding:13px 22px;font-size:14px;font-weight:700;color:${color};text-decoration:none;border-radius:12px;">${label}</a></td></tr></table>`;
  const joinBtn = hasMeet ? `<td class="stack" width="${data.googleCalUrl ? '50%' : '100%'}" valign="top" style="padding:4px;">${btn('&#127909;&nbsp; Join Google Meet &rarr;', data.meetUrl, B_BRAND)}</td>` : '';
  const calBtn = data.googleCalUrl ? `<td class="stack" width="${hasMeet ? '50%' : '100%'}" valign="top" style="padding:4px;">${btn('&#128197;&nbsp; Add to Calendar', data.googleCalUrl, '#ffffff', B_INK, '#D7D9E4')}</td>` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:600px){.stack{display:block!important;width:100%!important;padding:4px 0!important;}.container{width:100%!important;}.p-side{padding-left:18px!important;padding-right:18px!important;}.h1{font-size:24px!important;}}</style></head>
<body style="margin:0;padding:0;background:#F1F0F8;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">New demo assigned: ${besc(data.studentName)} &mdash; ${besc(data.dateLabel)}, ${besc(data.timeLabel)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F0F8;padding:24px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center"><table role="presentation" width="680" class="container" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid ${B_LINE};">
<tr><td class="p-side" style="padding:20px 28px;border-bottom:1px solid ${B_LINE};"><img src="${logoUrl}" alt="Thinkerzz" height="30" style="height:30px;width:auto;display:block;border:0;"></td></tr>
<tr><td class="p-side" style="padding:26px 28px 8px;"><span style="display:inline-block;background:${B_LAV};border:1px solid #E4DFFA;color:${B_BRAND};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">&#128197; New Demo Assigned</span><h1 class="h1" style="margin:14px 0 6px;font-size:28px;line-height:1.15;font-weight:800;color:${B_INK};">You Have a New <span style="color:${B_BRAND};">Demo Class</span></h1><p style="margin:8px 0 2px;font-size:15px;color:${B_INK};font-weight:700;">Assalam o Alaikum, Sir ${besc(teacher)}</p><p style="margin:2px 0 0;font-size:14px;color:${B_MUTED};line-height:1.6;">A new free demo class has been assigned to you. Please review the details below and be ready to conduct the session.</p></td></tr>
<tr><td class="p-side" style="padding:18px 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B_LAV};border:1px solid #E4DFFA;border-radius:18px;"><tr><td style="padding:18px 18px 6px;"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${B_BRAND};font-weight:800;">Demo Class</div><div style="font-size:24px;font-weight:800;color:${B_INK};margin-top:2px;">${besc(data.studentName)}</div></td></tr><tr><td style="padding:2px 10px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table></td></tr></table></td></tr>
<tr><td class="p-side" style="padding:14px 24px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${joinBtn}${calBtn}</tr></table>${hasMeet ? `<p style="margin:8px 4px 0;font-size:12px;color:${B_MUTED};text-align:center;">Meeting link: <a href="${data.meetUrl}" style="color:${B_BRAND};">${besc(data.meetUrl.replace(/^https?:\/\//, ''))}</a></p>` : `<p style="margin:8px 4px 0;font-size:12px;color:${B_MUTED};text-align:center;">The Google Meet link will be shared with you shortly.</p>`}</td></tr>
<tr><td class="p-side" style="padding:18px 28px 4px;"><div style="font-size:15px;font-weight:800;color:${B_INK};margin-bottom:8px;">Before the Demo</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:${B_INK};line-height:1.5;"><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">01</strong>&nbsp;&nbsp;Start the meeting on time and join 5 minutes early.</td></tr><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">02</strong>&nbsp;&nbsp;Keep the lesson material for ${besc(data.subject || 'the subject')} ready.</td></tr><tr><td valign="top" style="padding:4px 0;"><strong style="color:${B_BRAND};">03</strong>&nbsp;&nbsp;After the demo, record the outcome in the portal.</td></tr></table></td></tr>
<tr><td class="p-side" style="padding:14px 28px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7FB;border:1px solid ${B_LINE};border-radius:16px;"><tr><td style="padding:16px 18px;"><div style="font-size:14px;font-weight:800;color:${B_INK};">Need help?</div><div style="font-size:13px;color:${B_INK};margin-top:8px;">${data.whatsappNumber ? `&#128172;&nbsp; WhatsApp: <strong>${besc(data.whatsappNumber)}</strong>&nbsp;&nbsp;` : ''}&#9993;&nbsp; <a href="mailto:${besc(supportEmail)}" style="color:${B_BRAND};">${besc(supportEmail)}</a></div></td></tr></table></td></tr>
<tr><td class="p-side" style="padding:18px 28px 24px;border-top:1px solid ${B_LINE};text-align:center;"><div style="font-size:11px;color:${B_MUTED};line-height:1.6;">This is an automated message from Thinkerzz. Please do not reply.</div></td></tr>
</table></td></tr></table></body></html>`;
  const subject = `New Demo Assigned: ${data.studentName} - ${data.dateLabel}`;
  return { subject, html };
}

// ============================================================================
// Assemble the gallery
// ============================================================================
const bookingBase = { studentName: 'Ayesha Khan', parentName: 'Mr. Khan', bookingRef: 'TZ-8F3A', dateLabel: 'Sunday, 21 September 2026', timeLabel: '5:00 PM – 6:00 PM (PKT)', subject: 'Physics', program: 'O Level (O2)', durationLabel: '1 Hour', whatsappNumber: WA_NUMBER, whatsappUrl: 'https://wa.me/923207613778', googleCalUrl: '#', bookAnotherUrl: '#', homeUrl: '#' };

const entries = [
  { group: 'Parent / Student notices (queue → cron)', name: '1. Class Reminder', trig: 'AUTO · ~10–20 min before class · now has Add to Calendar', ...renderQueueEmail('class_reminder') },
  { group: 'Parent / Student notices (queue → cron)', name: '2. Class Rescheduled', trig: 'AUTO · when a class is rescheduled · now has Add to Calendar', ...renderQueueEmail('class_rescheduled') },
  { group: 'Parent / Student notices (queue → cron)', name: '3. Fee Due', trig: 'AUTO · voucher due date (no voucher no.)', ...renderQueueEmail('fee_due') },
  { group: 'Parent / Student notices (queue → cron)', name: '4. Grace Period Ending', trig: 'AUTO · grace nears end (no voucher no.)', ...renderQueueEmail('grace_ending') },
  { group: 'Parent / Student notices (queue → cron)', name: '5. Payment Received', trig: 'AUTO · when a payment is recorded', ...renderQueueEmail('payment_received') },
  { group: 'Parent / Student notices (queue → cron)', name: '6. Monthly Progress Report', trig: 'MANUAL · Settings button / ?manual=1', ...renderQueueEmail('monthly_report') },
  { group: 'Parent / Student notices (queue → cron)', name: '7. Follow-Up', trig: 'AUTO · lead follow-up date', ...renderQueueEmail('follow_up') },
  { group: 'Admin alert (queue → cron)', name: '8. Fee Decision Needed', trig: 'AUTO · grace expired unpaid (admin only, keeps voucher no.)', ...renderQueueEmail('grace_expired_admin') },
  { group: 'In-portal only', name: '9. Announcement', trig: 'IN-PORTAL ONLY · not emailed', ...renderQueueEmail('announcement') },
  { group: 'Account emails (direct send)', name: '10. Welcome / Set Password — Teacher', trig: 'MANUAL · admin grants portal access', ...welcomeTeacher() },
  { group: 'Account emails (direct send)', name: '11. Welcome / Set Password — Student', trig: 'MANUAL · admin grants portal access', ...welcomeStudent() },
  { group: 'Account emails (direct send)', name: '12. Password Reset', trig: 'MANUAL · admin clicks Reset', ...resetEmail() },
  { group: 'Account emails (direct send)', name: '13. Test Email', trig: 'MANUAL · Settings → Send Test', ...testEmail() },
  { group: 'Premium demo booking (direct send)', name: '14. Booking Confirmation — no teacher yet', trig: 'AUTO · sent to STUDENT on public booking (no teacher name)', ...renderBookingConfirmationEmail(bookingBase) },
  { group: 'Premium demo booking (direct send)', name: '15. Booking Confirmation — teacher assigned', trig: 'student state after a teacher + Meet link exist', ...renderBookingConfirmationEmail({ ...bookingBase, teacherName: 'Sir Ahmed Raza', meetUrl: 'https://meet.google.com/abc-defg-hij' }) },
  { group: 'Premium demo booking (direct send)', name: '16. Teacher Demo Notice — NEW', trig: 'AUTO · sent to the TEACHER when you assign the demo', ...renderTeacherDemoEmail({ teacherName: 'Ahmed Raza', studentName: 'Ayesha Khan', dateLabel: 'Sunday, 21 September 2026', timeLabel: '5:00 PM - 6:00 PM (PKT)', subject: 'Physics', durationLabel: '1 Hour', meetUrl: 'https://meet.google.com/abc-defg-hij', googleCalUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Thinkerzz+Physics+Free+Demo+Class', whatsappNumber: WA_NUMBER }) },
];

const cards = entries.map((e, i) => {
  const srcdoc = e.html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<section class="card">
    <div class="meta">
      <div class="grp">${e.group}</div>
      <h2>${e.name}</h2>
      <div class="subj"><span>Subject:</span> ${esc(e.subject)}</div>
      <div class="trig">${esc(e.trig)}</div>
    </div>
    <div class="frame"><iframe loading="lazy" srcdoc="${srcdoc}" title="${esc(e.name)}"></iframe></div>
  </section>`;
}).join('\n');

const groups = [...new Set(entries.map(e => e.group))];
const toc = groups.map(g => `<li>${g} <span class="cnt">(${entries.filter(e => e.group === g).length})</span></li>`).join('');

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thinkerzz Email Gallery</title>
<style>
  :root{--bg:#0f1020;--panel:#1a1b2e;--ink:#e8e9f3;--muted:#a4a7c4;--brand:#8b7bf0;--line:#2a2c44;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
  header{padding:28px 24px 18px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#16172b,#0f1020);}
  header h1{margin:0 0 6px;font-size:22px;font-weight:800;}
  header p{margin:0;color:var(--muted);font-size:13px;max-width:70ch;}
  .toc{padding:14px 24px;border-bottom:1px solid var(--line);}
  .toc ul{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px;}
  .toc li{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:12px;color:var(--muted);}
  .toc .cnt{color:var(--brand);font-weight:700;}
  .wrap{padding:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:22px;max-width:1600px;margin:0 auto;}
  @media(max-width:600px){.wrap{grid-template-columns:1fr;padding:14px}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;}
  .meta{padding:14px 16px;border-bottom:1px solid var(--line);}
  .grp{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);font-weight:700;}
  .meta h2{margin:4px 0 6px;font-size:16px;font-weight:700;}
  .subj{font-size:12px;color:var(--ink);}.subj span{color:var(--muted);}
  .trig{font-size:12px;color:var(--muted);margin-top:4px;}
  .frame{background:#F6F7FB;}
  iframe{width:100%;height:640px;border:0;display:block;background:#F6F7FB;}
</style></head>
<body>
<header>
  <h1>Thinkerzz — Email Design Gallery</h1>
  <p>Every outbound email rendered with sample data, exactly as the code produces it (16 states across 14 templates). Scroll each frame to see the full email. Sample student: <strong>Ayesha Khan</strong>.</p>
</header>
<nav class="toc"><strong>Groups:</strong><ul>${toc}</ul></nav>
<main class="wrap">${cards}</main>
</body></html>`;

const out = path.join(__dirname, 'email-gallery.html');
fs.writeFileSync(out, page, 'utf8');
console.log('WROTE', out, (page.length / 1024).toFixed(0) + 'KB');
