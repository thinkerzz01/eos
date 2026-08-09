'use client';

import React, { useState } from 'react';
import { submitPublicBooking } from './actions';
import { ALL_PROGRAMS, ALL_SUBJECTS } from '@/lib/syllabiSeed';
import {
  CheckCircle2, ArrowRight, AlertCircle, CalendarDays, BookOpen, Clock,
  User, GraduationCap, Phone, Mail, Search, MessageCircle, Video, ShieldCheck, Star,
} from 'lucide-react';

const HELP_WA = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || '923262324477').replace(/\D/g, '');
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
  const [program, setProgram] = useState('O Level');
  const [subject, setSubject] = useState('');
  const [source, setSource] = useState('');
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
    if (!time) { setError('Please choose a demo time.'); return; }

    setSubmitting(true);
    try {
      const res = await submitPublicBooking({ studentName, parentName, parentPhone, parentEmail, program, subject, source, date, time });
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

  const field = 'w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const plain = 'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const lbl = 'block text-xs font-bold text-slate-700 mb-1.5';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-[#171A2B] font-sans flex flex-col">
      {/* HEADER */}
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 py-3.5 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <img src="/logo-light.png" alt="Thinkerzz" className="h-8 w-auto object-contain" />
          <a href={`https://wa.me/${HELP_WA}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100 transition">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-bold">Need Help? Chat on WhatsApp</span>
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 flex-1 w-full">
        {!isSubmitted ? (
          <>
            {/* HERO */}
            <div className="text-center space-y-3 max-w-2xl mx-auto mb-8">
              <span className="px-4 py-1.5 bg-[#5B47D6]/10 text-[#5B47D6] text-xs font-extrabold rounded-full inline-flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Free 1-On-1 Live Demo Class
              </span>
              <h1 className="font-heading font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight leading-[1.1]">
                Book Your Free <span className="text-[#5B47D6]">Demo Class</span>
              </h1>
              <p className="text-sm sm:text-base text-slate-500 font-medium leading-relaxed">
                Pick a time that suits you, and our academic counselor will confirm your free trial class on WhatsApp with a Google Meet link.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
              {/* BENEFITS PANEL */}
              <aside className="rounded-3xl bg-gradient-to-br from-[#5B47D6] to-[#3F2F9E] text-white p-6 shadow-xl shadow-[#5B47D6]/20 lg:sticky lg:top-24">
                <h2 className="font-heading font-extrabold text-xl">What You Get</h2>
                <p className="text-xs text-indigo-200 font-medium mt-1">Your free demo, at no cost and no commitment.</p>
                <div className="space-y-4 mt-5">
                  {[
                    { icon: Video, t: 'Live 1-On-1 Class', d: 'A real online class on Google Meet with an expert teacher.' },
                    { icon: GraduationCap, t: 'Right Teacher For You', d: 'Matched to your subject and program.' },
                    { icon: Clock, t: '45 Minutes, Free', d: 'A full trial lesson, completely free.' },
                    { icon: CheckCircle2, t: 'No Commitment', d: 'Only continue if you love it.' },
                  ].map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.t} className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                        <div>
                          <div className="text-sm font-extrabold">{b.t}</div>
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
                    <div className="w-8 h-8 rounded-xl bg-[#5B47D6] text-white flex items-center justify-center text-sm font-extrabold">1</div>
                    <div className="font-heading font-extrabold text-base text-slate-900">Choose Your Slot</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Preferred Date <span className="text-rose-500">*</span></label>
                      <div className="relative"><CalendarDays className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="date" required value={date} min={todayPKT()} onChange={(e) => setDate(e.target.value)} className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>Subject <span className="text-rose-500">*</span></label>
                      <div className="relative"><BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <select required value={subject} onChange={(e) => setSubject(e.target.value)} className={field}>
                          <option value="">Select A Subject</option>
                          {ALL_SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select></div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={lbl}><span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Preferred Time (Pakistan Time) <span className="text-rose-500">*</span></span></label>
                    <div className="flex items-stretch gap-2">
                      <select required value={hour12} onChange={(e) => setHour12(e.target.value)} className={plain} aria-label="Hour">
                        <option value="">Hour</option>
                        {HOURS_12.map((h) => (<option key={h} value={h}>{h}</option>))}
                      </select>
                      <span className="flex items-center font-extrabold text-slate-300 text-lg">:</span>
                      <select value={minute} onChange={(e) => setMinute(e.target.value)} className={plain} aria-label="Minutes">
                        {MINUTES.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                      <select value={ampm} onChange={(e) => setAmpm(e.target.value)} className={plain} aria-label="AM or PM">
                        <option value="AM">AM</option><option value="PM">PM</option>
                      </select>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {time
                        ? <>You Chose <strong className="text-[#5B47D6]">{prettyTime(time)}</strong>. The free demo is one 45-minute class.</>
                        : <>Pick an hour to set your demo time. The free demo is one 45-minute class.</>}
                    </p>
                  </div>
                </div>

                {/* SECTION 2 */}
                <div className="pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-[#5B47D6] text-white flex items-center justify-center text-sm font-extrabold">2</div>
                    <div className="font-heading font-extrabold text-base text-slate-900">Your Details</div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={lbl}>Student Full Name <span className="text-rose-500">*</span></label>
                      <div className="relative"><User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Hamza Ali Khan" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>Academic Program <span className="text-rose-500">*</span></label>
                      <div className="relative"><GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <select value={program} onChange={(e) => setProgram(e.target.value)} className={field}>
                          {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                        </select></div>
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
                      <label className={lbl}>Email (Optional)</label>
                      <div className="relative"><Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="e.g. parent@example.com" className={field} /></div>
                    </div>
                    <div>
                      <label className={lbl}>How Did You Find Us?</label>
                      <div className="relative"><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <select value={source} onChange={(e) => setSource(e.target.value)} className={field}>
                          <option value="">Select An Option</option>
                          {HOW_FOUND.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select></div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-[#5B47D6] to-[#7C6BF0] hover:from-[#4F3DC7] hover:to-[#6B5AE0] text-white rounded-xl font-extrabold text-sm shadow-lg shadow-[#5B47D6]/25 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  <span>{submitting ? 'Confirming...' : 'Confirm My Free Demo'}</span>
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
                <p className="text-center text-xs text-slate-400 font-medium">Takes less than a minute. No payment required.</p>
              </form>
            </div>
          </>
        ) : (
          /* SUCCESS */
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-lg text-center space-y-5 max-w-xl mx-auto mt-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-gradient-to-tr from-emerald-400 to-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading font-extrabold text-3xl text-slate-900">Demo Booked!</h2>
              <p className="text-sm text-slate-600 font-medium max-w-md mx-auto">
                Thank you, <strong className="text-slate-900">{parentName}</strong>! Your free demo for <strong className="text-slate-900">{studentName}</strong> is booked.
              </p>
            </div>
            <div className="p-4 bg-[#5B47D6]/5 border border-[#5B47D6]/15 rounded-2xl space-y-1.5">
              <div className="text-[#5B47D6] text-xs uppercase tracking-wider font-bold">Booking Reference</div>
              <div className="font-mono text-2xl text-[#5B47D6] font-extrabold">{bookingRef}</div>
              <div className="text-slate-600 text-xs font-medium pt-1">
                {prettyDate}{time && <> at <strong>{prettyTime(time)} PKT</strong></>}{subject && <> for <strong>{subject}</strong></>}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 font-medium">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              We will send your Google Meet link to <strong className="text-slate-700">&nbsp;{parentPhone}</strong>&nbsp; on WhatsApp shortly.
            </div>
            <button
              onClick={() => {
                setIsSubmitted(false); setStudentName(''); setParentName(''); setParentPhone('');
                setParentEmail(''); setHour12(''); setMinute('00'); setAmpm('PM'); setSubject(''); setSource(''); setBookingRef('');
              }}
              className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition">
              Book Another Demo
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 py-5 text-center text-xs text-slate-400 font-medium">
        Thinkerzz · Question. Think. Achieve.
      </footer>
    </div>
  );
}
