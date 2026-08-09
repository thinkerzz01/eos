'use client';

import React, { useState } from 'react';
import { submitPublicBooking } from './actions';
import { ALL_PROGRAMS, ALL_SUBJECTS } from '@/lib/syllabiSeed';
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const HOW_FOUND = ['Google', 'Facebook', 'Instagram', 'WhatsApp', 'Referral', 'Walk-in'];

// Format a HH:MM (24h) time as a human 12h label, e.g. "4:30 PM".
function prettyTime(t: string): string {
  if (!/^\d{2}:\d{2}$/.test(t)) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:${String(m).padStart(2, '0')} ${period}`;
}

// Today's date in Pakistan time as YYYY-MM-DD (min selectable date).
function todayPKT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

// Build a 24h "HH:MM" from friendly 12-hour parts (hour 1-12, minute, AM/PM).
function to24(hour12: string, minute: string, ampm: string): string {
  if (!hour12) return '';
  let h = parseInt(hour12, 10) % 12; // 12 -> 0
  if (ampm === 'PM') h += 12; // 12 PM -> 12, 12 AM -> 0
  return `${String(h).padStart(2, '0')}:${minute}`;
}

const HOURS_12 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '15', '30', '45'];

export default function PublicBookingPage() {
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [program, setProgram] = useState('O Level');
  const [subject, setSubject] = useState('');
  const [source, setSource] = useState('');
  const [date, setDate] = useState<string>(todayPKT());
  // Human-friendly time parts; combined into a 24h "HH:MM" for the backend.
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
    if (!time) {
      setError('Please choose a demo time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitPublicBooking({
        studentName,
        parentName,
        parentPhone,
        parentEmail,
        program,
        subject,
        source,
        date,
        time,
      });
      if (!res.ok) {
        setError(res.error || 'Something went wrong. Please try again.');
        return;
      }
      setBookingRef(res.ref || 'THM-BOOKING');
      setIsSubmitted(true);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const prettyDate = date
    ? new Date(`${date}T00:00:00+05:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Karachi',
      })
    : '';

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#171A2B] font-sans flex flex-col justify-between">

      {/* PUBLIC HEADER */}
      <header className="bg-white border-b border-[#EBEDF3] py-4 px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo-light.png" alt="Thinkerzz" className="h-9 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-extrabold rounded-full border border-emerald-200">
              🟢 24/7 Instant Demo Booking
            </span>
          </div>
        </div>
      </header>

      {/* HERO & BOOKING FORM CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {!isSubmitted ? (
          <div className="space-y-8">

            {/* HERO TITLE */}
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="px-3.5 py-1 bg-purple-100 text-[#5B47D6] text-xs font-extrabold rounded-full inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Book a Free Live Demo Class</span>
              </span>
              <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 tracking-tight">
                Experience Pakistan's Premier Academic OS
              </h1>
              <p className="text-sm text-[#6B7185] font-medium leading-relaxed">
                Choose a date and time below, enter your details, and our academic counselor will confirm your free 1-on-1 demo trial class over WhatsApp.
              </p>
            </div>

            {/* FORM CARD */}
            <form onSubmit={handleSubmitBooking} className="bg-white border border-[#EBEDF3] rounded-[24px] p-6 sm:p-8 shadow-xl space-y-6">

              {/* STEP 1: PICK A DATE & TIME SLOT */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-heading font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full bg-[#5B47D6] text-white flex items-center justify-center text-xs">1</div>
                  <span>Select Demo Date & Time</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <label className="text-slate-700 block mb-1">Preferred Date *</label>
                    <input
                      type="date"
                      required
                      value={date}
                      min={todayPKT()}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1">Subject *</label>
                    <select
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">Select subject...</option>
                      {ALL_SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>

                {/* SIMPLE TIME PICKER - hour : minute AM/PM, the way people read a clock */}
                <div className="text-xs font-bold">
                  <label className="text-slate-700 block mb-1">Preferred Time (Pakistan Time) *</label>
                  <div className="flex items-stretch gap-2">
                    <select
                      required
                      value={hour12}
                      onChange={(e) => setHour12(e.target.value)}
                      className="flex-1 bg-[#F8F9FD] border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#5B47D6]"
                      aria-label="Hour"
                    >
                      <option value="">Hour</option>
                      {HOURS_12.map((h) => (<option key={h} value={h}>{h}</option>))}
                    </select>
                    <span className="flex items-center font-extrabold text-slate-400">:</span>
                    <select
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                      className="flex-1 bg-[#F8F9FD] border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#5B47D6]"
                      aria-label="Minutes"
                    >
                      {MINUTES.map((m) => (<option key={m} value={m}>{m}</option>))}
                    </select>
                    <select
                      value={ampm}
                      onChange={(e) => setAmpm(e.target.value)}
                      className="flex-1 bg-[#F8F9FD] border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#5B47D6]"
                      aria-label="AM or PM"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  <p className="mt-2 font-medium text-slate-500">
                    {time
                      ? <>You chose: <strong className="text-[#5B47D6]">{prettyTime(time)}</strong> (Pakistan Time). The free demo is one 45-minute class.</>
                      : <>Choose an hour to set your demo time. The free demo is one 45-minute class.</>}
                  </p>
                </div>
              </div>

              {/* STEP 2: PARENT & STUDENT DETAILS */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 font-heading font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full bg-[#5B47D6] text-white flex items-center justify-center text-xs">2</div>
                  <span>Enter Student & Parent Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <label className="text-slate-700 block mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Hamza Khan"
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Academic Program *</label>
                    <select
                      value={program}
                      onChange={(e) => setProgram(e.target.value)}
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    >
                      {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Parent / Guardian Name *</label>
                    <input
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="e.g. Mr. Shahzaib Khan"
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">WhatsApp Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="+92 300 0000000"
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Email (optional)</label>
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">How did you find us?</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]"
                    >
                      <option value="">Select...</option>
                      {HOW_FOUND.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-extrabold text-sm shadow-lg shadow-[#5B47D6]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{submitting ? 'Confirming...' : 'Confirm Free Demo Booking'}</span>
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>

            </form>
          </div>
        ) : (
          /* SUCCESS CONFIRMATION SCREEN */
          <div className="bg-white border border-[#EBEDF3] rounded-[24px] p-8 shadow-xl text-center space-y-6 max-w-xl mx-auto animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading font-extrabold text-2xl text-slate-900">Demo Class Booking Confirmed!</h2>
              <p className="text-xs text-[#6B7185] font-medium max-w-md mx-auto">
                Thank you, <strong className="text-slate-900">{parentName}</strong>! Your demo trial booking for <strong className="text-slate-900">{studentName}</strong> has been logged in our system.
              </p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2 text-xs font-bold">
              <div className="text-purple-700 text-xs uppercase tracking-wider">Booking Reference Code</div>
              <div className="font-mono text-2xl text-[#5B47D6] font-extrabold">{bookingRef}</div>
              <div className="text-slate-600 text-xs font-medium pt-1">
                Requested Slot: <strong>{prettyDate}</strong>{time && <> at <strong>{prettyTime(time)} PKT</strong></>}{subject && <> for <strong>{subject}</strong></>}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Our Academic Counselor will send the Google Meet link to <strong>{parentPhone}</strong> via WhatsApp shortly.
            </div>

            <button
              onClick={() => {
                setIsSubmitted(false);
                setStudentName('');
                setParentName('');
                setParentPhone('');
                setParentEmail('');
                setHour12('');
                setMinute('00');
                setAmpm('PM');
                setSubject('');
                setSource('');
                setBookingRef('');
              }}
              className="px-6 py-2.5 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            >
              Book Another Demo Session
            </button>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#EBEDF3] py-4 text-center text-xs text-slate-400 font-medium">
        Thinkerzz Operating System (EOS v3.1) · All rights reserved.
      </footer>

    </div>
  );
}
