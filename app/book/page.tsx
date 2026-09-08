'use client';

import React, { useState } from 'react';
import { submitPublicBooking } from './actions';
import { BookingSuccess } from './BookingSuccess';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import { ALL_PROGRAMS, subjectsForProgram, subjectLabel } from '@/lib/syllabiSeed';
import {
  CheckCircle2, ArrowRight, AlertCircle, CalendarDays, BookOpen, Clock,
  User, GraduationCap, Phone, Mail, Search, MessageCircle, Video, ShieldCheck, Star,
  MapPin, School,
} from 'lucide-react';

const HELP_WA = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || '923262324477').replace(/\D/g, '');
// "Back to Home" target on the success screen. Set NEXT_PUBLIC_ACADEMY_WEBSITE
// to the public marketing site; falls back to the academy domain.
const HOME_URL = process.env.NEXT_PUBLIC_ACADEMY_WEBSITE || 'https://thinkerzz.com';
const HOW_FOUND = ['Google', 'Facebook', 'Instagram', 'WhatsApp', 'Referral', 'Walk-in'];
const HOURS_12 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];

function prettyTime(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
}
function todayPKT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}
function to24(hour12: string, minute: string, ampm: string): string {
  if (!hour12) return '';
  let h = parseInt(hour12, 10) % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export default function PublicBookingPage() {
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [program, setProgram] = useState<string>(ALL_PROGRAMS[0]);
  const [subject, setSubject] = useState('');
  const [source, setSource] = useState('');
  const [school, setSchool] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [date, setDate] = useState<string>(todayPKT());
  const [hour12, setHour12] = useState<string>('');
  const [minute, setMinute] = useState<string>('00');
  const [ampm, setAmpm] = useState<string>('PM');
  const time = to24(hour12, minute, ampm);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!studentName || !parentName || !parentPhone) {
      setError('Please fill in the student name, parent name, and phone number.');
      return;
    }
    if (!subject) { setError('Please select a subject.'); return; }
    if (!source) { setError('Please tell us how you found us.'); return; }
    if (!school.trim()) { setError('Please enter the school name.'); return; }
    if (!city.trim()) { setError('Please enter the city / hometown.'); return; }
    if (!area.trim()) { setError('Please enter your area / town / society.'); return; }
    if (!time) { setError('Please choose a demo time.'); return; }

    setSubmitting(true);
    try {
      const res = await submitPublicBooking({ studentName, parentName, parentPhone, parentEmail, program, subject, source, school, city, area, date, time, turnstileToken });
      if (!res.ok) { setError(res.error || 'Something went wrong. Please try again.'); return; }
      setBookingRef(res.ref || 'THM-BOOKING');
      setIsSubmitted(true);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const prettyDate = date
    ? new Date(`${date}T00:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })
    : '';

  // Sundays are usually the academy's day off, so tutor availability is limited.
  // We DON'T block the date - we just warn the family and point them to WhatsApp
  // to confirm a tutor before they rely on a Sunday slot. Weekday is read in PKT
  // so it matches the timezone the demo is scheduled in.
  const isSunday = date
    ? new Date(`${date}T00:00:00+05:00`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Karachi' }) === 'Sunday'
    : false;

  const field = 'w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const plain = 'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const lbl = 'block text-xs font-medium text-slate-700 mb-1.5';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-[#171A2B] font-sans flex flex-col">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 py-3.5 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <img src="/logo-light.png" alt="Thinkerzz" className="h-8 w-auto object-contain" />
          <a href={`https://wa.me/${HELP_WA}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100 transition">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Need Help? Chat on WhatsApp</span>
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 flex-1 w-full">
        {!isSubmitted ? (
          <>
            {/* HERO */}
            <div className="text-center space-y-3 max-w-2xl mx-auto mb-8">
              <span className="px-4 py-1.5 bg-[#5B47D6]/10 text-[#5B47D6] text-xs font-medium rounded-full inline-flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Free 1-On-1 Live Demo Class
              </span>
              <h1 className="font-heading font-medium text-4xl sm:text-5xl text-slate-900 tracking-tight leading-[1.1]">
                Book Your Free <span className="text-[#5B47D6]">Demo Class</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed">
                Pick a time that suits you, and our academic counselor will confirm your free trial class on WhatsApp with a Google Meet link.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
              {/* BENEFITS PANEL */}
              <aside className="rounded-3xl bg-gradient-to-br from-[#5B47D6] to-[#3F2F9E] text-white p-6 shadow-xl shadow-[#5B47D6]/20 lg:sticky lg:top-24">
                <h2 className="font-heading font-medium text-xl">What You Get</h2>
                <p className="text-xs text-indigo-200 font-medium mt-1">Your free demo, at no cost and no commitment.</p>
                <div className="space-y-4 mt-5">
                  {[
                    { icon: Video, t: 'Live 1-On-1 Class', d: 'A real online class on Google Meet with an expert teacher.' },
                    { icon: GraduationCap, t: 'Right Teacher For You', d: 'Matched to your subject and program.' },
                    { icon: Clock, t: '30 Minutes, Free', d: 'A full trial lesson, completely free.' },
                    { icon: CheckCircle2, t: 'No Commitment', d: 'Only continue if you love it.' },
                  ].map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.t} className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                        <div>
                          <div className="text-sm font-medium">{b.t}</div>
                          <div className="text-xs text-indigo-200 font-medium leading-snug">{b.d}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white/10 p-3 text-xs font-medium text-indigo-100">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> Your details are safe and only used to arrange your class.
                </div>
              </aside>

              {/* FORM */}
              <form onSubmit={handleSubmitBooking} className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-7">
                {/* SECTION 1 */}
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-[#5B47D6] text-white flex items-center justify-center text-sm font-medium">1</div>
                    <div className="font-heading font-medium text-base text-slate-900">Choose Your Slot</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Preferred Date <span className="text-rose-500">*</span></label>
                      <div className="relative"><CalendarDays className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="date" required value={date} min={todayPKT()} onChange={(e) => setDate(e.target.value)} className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>Academic Program <span className="text-rose-500">*</span></label>
                      <div className="relative"><GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <select
                          value={program}
                          onChange={(e) => {
                            const p = e.target.value;
                            setProgram(p);
                            // Keep the subject only if it belongs to the newly chosen program.
                            if (!subjectsForProgram(p).includes(subject)) setSubject('');
                          }}
                          className={field}
                        >
                          {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                        </select></div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={lbl}>Subject <span className="text-rose-500">*</span></label>
                    <div className="relative"><BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <select required value={subject} onChange={(e) => setSubject(e.target.value)} className={field}>
                        <option value="">Select A Subject</option>
                        {subjectsForProgram(program).map((s) => (<option key={s} value={s}>{subjectLabel(s)}</option>))}
                      </select></div>
                    <p className="mt-1 text-[11px] text-slate-400 font-medium">Only subjects offered for your selected program are shown.</p>
                  </div>

                  {/* SUNDAY NOTICE — Sunday stays selectable; we just flag limited availability */}
                  {isSunday && (
                    <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium leading-relaxed">
                        You picked a <strong>Sunday</strong>. Sundays are usually our day off, so tutor availability is limited - but you can still request this slot. We&apos;ll confirm the schedule and a tutor for you before finalizing.{' '}
                        <a
                          href={`https://wa.me/${HELP_WA}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Confirm availability on WhatsApp
                        </a>
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Preferred Time (Pakistan Time) <span className="text-rose-500">*</span></span></label>
                    <div className="flex items-stretch gap-2">
                      <select required value={hour12} onChange={(e) => setHour12(e.target.value)} className={plain} aria-label="Hour">
                        <option value="">Hour</option>
                        {HOURS_12.map((h) => (<option key={h} value={h}>{h}</option>))}
                      </select>
                      <span className="flex items-center font-medium text-slate-300 text-lg">:</span>
                      <select value={minute} onChange={(e) => setMinute(e.target.value)} className={plain} aria-label="Minutes">
                        {MINUTES.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                      <select value={ampm} onChange={(e) => setAmpm(e.target.value)} className={plain} aria-label="AM or PM">
                        <option value="AM">AM</option><option value="PM">PM</option>
                      </select>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {time
                        ? <>You Chose <strong className="text-[#5B47D6]">{prettyTime(time)}</strong>. The free demo is one 30-minute class.</>
                        : <>Pick an hour to set your demo time. The free demo is one 30-minute class.</>}
                    </p>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-[#5B47D6] text-white flex items-center justify-center text-sm font-medium">2</div>
                    <div className="font-heading font-medium text-base text-slate-900">Your Details</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Student Full Name <span className="text-rose-500">*</span></label>
                      <div className="relative"><User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Hamza Ali Khan" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>Parent / Guardian Name <span className="text-rose-500">*</span></label>
                      <div className="relative"><User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="e.g. Mr. Shahzaib Khan" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>WhatsApp Number <span className="text-rose-500">*</span></label>
                      <div className="relative"><Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+92 300 0000000" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>Email <span className="text-rose-500">*</span></label>
                      <div className="relative"><Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="email" required value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="e.g. parent@gmail.com" className={field} /></div>
                      <p className="text-[11px] text-slate-400 mt-1">Your demo class invite is sent here.</p>
                    </div>
                    <div>
                      <label className={lbl}>How Did You Find Us? <span className="text-rose-500">*</span></label>
                      <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <select required value={source} onChange={(e) => setSource(e.target.value)} className={field}>
                          <option value="">Select An Option</option>
                          {HOW_FOUND.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select></div>
                    </div>
                    <div>
                      <label className={lbl}>School Name <span className="text-rose-500">*</span></label>
                      <div className="relative"><School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Beaconhouse School System" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>City / Hometown <span className="text-rose-500">*</span></label>
                      <div className="relative"><MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className={field} /></div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={lbl}>Area / Town / Society <span className="text-rose-500">*</span></label>
                      <div className="relative"><MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. DHA Phase 5, Gulshan-e-Iqbal, Model Town" className={field} /></div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                  </div>
                )}

                <TurnstileWidget onToken={setTurnstileToken} />

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-[#5B47D6] to-[#7C6BF0] hover:from-[#4F3DC7] hover:to-[#6B5AE0] text-white rounded-xl font-medium text-sm shadow-lg shadow-[#5B47D6]/25 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <span>{submitting ? 'Confirming...' : 'Confirm My Free Demo'}</span>
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
                <p className="text-center text-xs text-slate-400 font-medium">Takes less than a minute. No payment required.</p>
              </form>
            </div>
          </>
        ) : (
          /* SUCCESS — premium, animated confirmation experience */
          <BookingSuccess
            bookingRef={bookingRef}
            studentName={studentName}
            parentName={parentName}
            parentPhone={parentPhone}
            subject={subject}
            program={program}
            prettyDate={prettyDate}
            timeLabel={time ? `${prettyTime(time)} (PKT)` : ''}
            dateISO={date}
            time24={time}
            durationMinutes={30}
            helpWa={HELP_WA}
            homeUrl={HOME_URL}
            onBookAnother={() => {
              setIsSubmitted(false); setStudentName(''); setParentName(''); setParentPhone('');
              setParentEmail(''); setHour12(''); setMinute('00'); setAmpm('PM'); setSubject(''); setSource(''); setSchool(''); setCity(''); setArea(''); setBookingRef('');
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-100 py-5 text-center text-xs text-slate-400 font-medium">
        Thinkerzz · Question. Think. Achieve.
      </footer>
    </div>
  );
}
