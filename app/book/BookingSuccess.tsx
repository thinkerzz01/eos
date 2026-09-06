'use client';

// Premium demo-booking confirmation screen. Rendered ONLY after a successful
// submit (the parent page flips to it), so the celebration plays exactly once
// per booking - a refresh resets React state back to the form, never re-plays.
// Everything here is driven by the real booking data passed as props; any field
// without a value is hidden rather than shown blank. Respects reduced-motion.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, Check, CalendarPlus, ChevronDown, Download, MessageCircle, ArrowRight,
  Home, Clock, BookOpen, GraduationCap, Timer, CalendarDays, Video, LifeBuoy,
} from 'lucide-react';

export interface BookingSuccessProps {
  bookingRef: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  subject: string;
  program: string;
  prettyDate: string; // e.g. "Sun, 6 Sept 2026"
  timeLabel: string; // e.g. "5:00 PM (PKT)"
  dateISO: string; // "YYYY-MM-DD" (PKT)
  time24: string; // "HH:MM" (PKT)
  durationMinutes?: number; // default 30
  helpWa: string; // academy WhatsApp, digits only
  homeUrl?: string; // "Back to Home" target
  onBookAnother: () => void;
}

const GREETING = (name: string) => (name?.trim() ? name.trim() : 'there');

export function BookingSuccess(props: BookingSuccessProps) {
  const {
    bookingRef, studentName, parentName, parentPhone, subject, program,
    prettyDate, timeLabel, dateISO, time24, durationMinutes = 30, helpWa,
    homeUrl = '/', onBookAnother,
  } = props;

  const [reduced, setReduced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const calWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch { /* no matchMedia -> assume motion allowed */ }
    // Move focus to the success heading so screen readers announce the outcome.
    const t = setTimeout(() => headingRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Close the calendar menu on outside click / Escape.
  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => {
      if (calWrapRef.current && !calWrapRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [calOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked -> no-op, the reference is still visible */ }
  };

  // ---- Calendar links ------------------------------------------------------
  const { googleUrl, icsHref, icsName } = useMemo(() => {
    const start = new Date(`${dateISO}T${time24}:00+05:00`);
    if (isNaN(start.getTime())) return { googleUrl: '', icsHref: '', icsName: '' };
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const title = `Thinkerzz ${subject || ''} Demo Class`.replace(/\s+/g, ' ').trim();
    const details = [
      'Your free 1-on-1 Thinkerzz demo class.',
      program ? `Program: ${program}.` : '',
      `Booking reference: ${bookingRef}.`,
      'Your Google Meet link will be shared on WhatsApp before the class.',
    ].filter(Boolean).join(' ');
    const g = new URLSearchParams({
      action: 'TEMPLATE', text: title, dates: `${z(start)}/${z(end)}`,
      details, location: 'Google Meet',
    });
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Thinkerzz//Demo Booking//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:${bookingRef}@thinkerzz`, `DTSTAMP:${z(new Date())}`,
      `DTSTART:${z(start)}`, `DTEND:${z(end)}`,
      `SUMMARY:${title}`, `DESCRIPTION:${details.replace(/,/g, '\\,')}`,
      'LOCATION:Google Meet', 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    return {
      googleUrl: `https://calendar.google.com/calendar/render?${g.toString()}`,
      icsHref: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
      icsName: `Thinkerzz-Demo-${bookingRef}.ics`,
    };
  }, [dateISO, time24, durationMinutes, subject, program, bookingRef]);

  // ---- WhatsApp (contact the academy, prefilled with the reference) --------
  const waHref = helpWa
    ? `https://wa.me/${helpWa}?text=${encodeURIComponent(
        `Hi Thinkerzz, I just booked a free demo (Ref: ${bookingRef}) for ${studentName || 'my child'}.`
      )}`
    : '';

  // ---- Confetti particles (decorative; skipped under reduced-motion) -------
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 10 + 0.35;
        const dist = 70 + (i % 3) * 26;
        return {
          tx: `${Math.round(Math.cos(angle) * dist)}px`,
          ty: `${Math.round(Math.sin(angle) * dist)}px`,
          rot: `${(i % 2 ? 1 : -1) * (180 + i * 24)}deg`,
          color: i % 2 ? '#22C55E' : '#5B47D6',
          delay: `${(i % 5) * 30}ms`,
          round: i % 3 === 0,
        };
      }),
    []
  );

  const steps = [
    { n: '01', title: 'Booking Confirmed', desc: 'Your demo request has been received.', state: 'done' as const },
    { n: '02', title: 'Teacher Confirmation', desc: 'We assign the right teacher for you.', state: 'next' as const },
    { n: '03', title: 'Google Meet Link Sent', desc: 'You get the join link on WhatsApp.', state: 'upcoming' as const },
  ];

  const fieldIcon = 'w-4 h-4 text-[#5B47D6]';

  return (
    <div className="max-w-[1120px] mx-auto w-full">
      <style>{css}</style>

      <div className="tz-card bg-white border border-slate-200/80 rounded-[28px] shadow-[0_20px_60px_-24px_rgba(30,20,90,0.25)] px-5 sm:px-10 py-8 sm:py-11">
        {/* SUCCESS ANIMATION */}
        <div className="flex flex-col items-center text-center">
          <div className="relative" aria-hidden="true">
            <div className="tz-halo absolute inset-0 -m-6 rounded-full bg-[#5B47D6]/10 blur-xl" />
            <div className={`tz-badge relative w-24 h-24 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center ${reduced ? 'tz-reduced' : ''}`}>
              <svg viewBox="0 0 52 52" className="w-14 h-14">
                <circle className="tz-ring" cx="26" cy="26" r="23" fill="none" stroke="#22C55E" strokeWidth="3" />
                <path className="tz-tick" fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M15 27 l7.5 7.5 L38 18" />
              </svg>
            </div>
            {!reduced && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 w-0 h-0">
                {particles.map((p, i) => (
                  <span
                    key={i}
                    className="tz-confetti"
                    style={{
                      // @ts-expect-error - CSS custom properties
                      '--tx': p.tx, '--ty': p.ty, '--rot': p.rot,
                      background: p.color,
                      animationDelay: p.delay,
                      borderRadius: p.round ? '9999px' : '2px',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div role="status" aria-live="polite" className="mt-6">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-heading font-medium text-3xl sm:text-4xl text-slate-900 tracking-tight outline-none"
            >
              Demo Booked! <span aria-hidden="true">🎉</span>
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 font-medium">
              Thank you, <strong className="text-slate-900">{GREETING(parentName)}</strong>!
            </p>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Your free demo{studentName ? <> for <strong className="text-slate-900">{studentName}</strong></> : null} is confirmed.
            </p>
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1.5">
            <Check className="w-3.5 h-3.5" /> Booking Confirmed
          </span>
        </div>

        {/* CONTENT GRID */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
          {/* BOOKING SUMMARY */}
          <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6" aria-label="Booking details">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#5B47D6]">Booking Reference</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">{bookingRef}</span>
                  <button
                    onClick={handleCopy}
                    aria-label={copied ? 'Reference copied' : 'Copy booking reference'}
                    className="tz-press inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-[#5B47D6] hover:border-[#5B47D6]/40 transition"
                  >
                    {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Add to Calendar */}
              {googleUrl && (
                <div className="relative" ref={calWrapRef}>
                  <button
                    onClick={() => setCalOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={calOpen}
                    className="tz-press inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#5B47D6]/40 hover:text-[#5B47D6] transition"
                  >
                    <CalendarPlus className="w-4 h-4" /> Add to Calendar
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${calOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {calOpen && (
                    <div role="menu" className="absolute right-0 z-20 mt-1.5 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <a
                        role="menuitem"
                        href={googleUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setCalOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <CalendarDays className="w-4 h-4 text-[#5B47D6]" /> Google Calendar
                      </a>
                      <a
                        role="menuitem"
                        href={icsHref}
                        download={icsName}
                        onClick={() => setCalOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="w-4 h-4 text-slate-500" /> Download .ICS
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <Field icon={<CalendarDays className={fieldIcon} />} label="Date" value={prettyDate} />
              <Field icon={<Clock className={fieldIcon} />} label="Time" value={timeLabel} />
              {subject && <Field icon={<BookOpen className={fieldIcon} />} label="Subject" value={subject} />}
              {program && <Field icon={<GraduationCap className={fieldIcon} />} label="Program" value={program} />}
              <Field icon={<Timer className={fieldIcon} />} label="Duration" value={`${durationMinutes} Minutes`} />
            </div>
          </section>

          {/* WHATSAPP CONFIRMATION */}
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 flex flex-col" aria-label="WhatsApp confirmation">
            <div className="flex items-center gap-2 text-emerald-700">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <MessageCircle className="w-4.5 h-4.5" />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide">WhatsApp Confirmation</span>
            </div>
            <p className="mt-3 text-sm text-slate-700 font-medium leading-relaxed">
              We&apos;ll send your Google Meet link
              {parentPhone ? <> to <strong className="text-slate-900">{parentPhone}</strong></> : null} on WhatsApp shortly.
            </p>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="tz-press mt-auto pt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-3 transition shadow-sm shadow-emerald-600/20"
              >
                <MessageCircle className="w-4 h-4" /> Open WhatsApp <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </section>
        </div>

        {/* WHAT'S NEXT */}
        <section className="mt-8" aria-label="What happens next">
          <h2 className="font-heading font-medium text-base text-slate-900 mb-4">What&apos;s Next?</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 relative">
            {steps.map((s, i) => (
              <li key={s.n} className="relative flex md:flex-col gap-3 md:gap-0 md:pr-6">
                {/* connector (desktop) */}
                {i < steps.length - 1 && (
                  <span aria-hidden="true" className="hidden md:block absolute top-4 left-[calc(2rem+8px)] right-2 h-px border-t border-dashed border-slate-300" />
                )}
                <div className="flex md:mb-3">
                  <span
                    className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                      s.state === 'done'
                        ? 'bg-[#5B47D6] text-white shadow-sm shadow-[#5B47D6]/30'
                        : 'bg-white text-slate-500 border border-slate-300'
                    }`}
                  >
                    {s.state === 'done' ? <Check className="w-4 h-4" /> : s.n}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{s.title}</div>
                  <div className="text-xs text-slate-500 font-medium leading-snug mt-0.5">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ACTIONS */}
        <div className="mt-8 space-y-3">
          <button
            onClick={onBookAnother}
            className="tz-press w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-sm font-medium py-3.5 shadow-lg shadow-[#5B47D6]/25 transition"
          >
            <CalendarPlus className="w-4 h-4" /> Book Another Demo <ArrowRight className="w-4 h-4" />
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="tz-press inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium py-3 transition"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
            )}
            <a
              href={homeUrl}
              className="tz-press inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium py-3 transition"
            >
              <Home className="w-4 h-4" /> Back to Home
            </a>
          </div>
        </div>

        {/* SUPPORT */}
        {waHref && (
          <div className="mt-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-[#5B47D6]/10 flex items-center justify-center shrink-0">
                <LifeBuoy className="w-4.5 h-4.5 text-[#5B47D6]" />
              </span>
              <div>
                <div className="text-sm font-medium text-slate-900">Need help?</div>
                <div className="text-xs text-slate-500 font-medium">Our team is available on WhatsApp to assist you.</div>
              </div>
            </div>
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="tz-press inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium px-4 py-2.5 transition shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp Us
            </a>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-8 text-center">
          <div className="font-heading font-medium text-[#5B47D6]">Thinkerzz</div>
          <div className="text-xs text-slate-400 font-medium">Question. Think. Achieve.</div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide font-medium text-slate-400">{label}</div>
        <div className="text-sm font-medium text-slate-900 break-words">{value}</div>
      </div>
    </div>
  );
}

// Animations live here so the whole celebration is self-contained. The
// reduced-motion media query neutralises every animation to an instant final
// state (confetti DOM is not rendered at all when reduced motion is set).
const css = `
.tz-card { animation: tzCardIn .45s cubic-bezier(.2,.8,.2,1) both; }
.tz-badge { animation: tzPop .45s .05s cubic-bezier(.2,1.3,.4,1) both; }
.tz-halo { animation: tzHalo .6s .1s ease-out both; }
.tz-ring { stroke-dasharray: 145; stroke-dashoffset: 145; animation: tzDraw .5s .15s ease-out forwards; }
.tz-tick { stroke-dasharray: 40; stroke-dashoffset: 40; animation: tzDraw .35s .5s ease-out forwards; }
.tz-confetti { position:absolute; left:0; top:0; width:9px; height:9px; opacity:0; animation: tzBurst 1s .35s cubic-bezier(.15,.7,.3,1) forwards; }
.tz-press { will-change: transform; }
.tz-press:hover { transform: translateY(-1px); }
.tz-press:active { transform: translateY(0); }

@keyframes tzCardIn { from { opacity:0; transform: scale(.985) translateY(8px); } to { opacity:1; transform:none; } }
@keyframes tzPop { from { opacity:0; transform: scale(.6); } to { opacity:1; transform: scale(1); } }
@keyframes tzHalo { from { opacity:0; transform: scale(.5); } to { opacity:1; transform: scale(1); } }
@keyframes tzDraw { to { stroke-dashoffset: 0; } }
@keyframes tzBurst { 0% { opacity:1; transform: translate(0,0) rotate(0); } 100% { opacity:0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); } }

@media (prefers-reduced-motion: reduce) {
  .tz-card, .tz-badge, .tz-halo { animation: tzFade .2s ease-out both; }
  .tz-ring, .tz-tick { animation: none; stroke-dashoffset: 0; }
  .tz-press:hover, .tz-press:active { transform: none; }
  @keyframes tzFade { from { opacity:0; } to { opacity:1; } }
}
`;
