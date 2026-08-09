'use client';

import React, { useState } from 'react';
import { submitEnrollment } from './actions';
import { ALL_PROGRAMS, EXAM_SESSIONS } from '@/lib/syllabiSeed';
import { CheckCircle2, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';

export default function EnrollPage({ params }: { params: { leadId: string } }) {
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [program, setProgram] = useState('O Level');
  const [examSession, setExamSession] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!studentName || !parentName || !phone || !examSession) {
      setError('Please fill in the student name, parent name, phone, and exam session.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitEnrollment({
        leadId: params.leadId,
        studentName,
        parentName,
        phone,
        email,
        program,
        examSession,
        gender,
        city,
        address,
      });
      if (!res.ok) {
        setError(res.error || 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const input =
    'w-full bg-[#F8F9FD] border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-[#5B47D6]';

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#171A2B] font-sans flex flex-col justify-between">
      <header className="bg-white border-b border-[#EBEDF3] py-4 px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-heading font-black text-xl shadow-md">
            T
          </div>
          <div>
            <div className="font-heading font-extrabold text-xl tracking-tight text-slate-900">THINKERZZ ACADEMY</div>
            <div className="text-xs font-bold text-[#5B47D6] tracking-wider uppercase">Student Enrollment</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">
        {!done ? (
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <span className="px-3.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-full inline-flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Welcome to Thinkerzz - Complete Your Enrollment</span>
              </span>
              <h1 className="font-heading font-extrabold text-3xl text-slate-900 tracking-tight">Enrollment Details</h1>
              <p className="text-sm text-[#6B7185] font-medium leading-relaxed">
                Please fill in the student's details to complete enrollment. Our team will then set up the fee and class schedule.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white border border-[#EBEDF3] rounded-[24px] p-6 sm:p-8 shadow-xl space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 block mb-1">Student Full Name *</label>
                  <input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="e.g. Hamza Khan" className={input} />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={input}>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Academic Program *</label>
                  <select value={program} onChange={(e) => setProgram(e.target.value)} className={input}>
                    {ALL_PROGRAMS.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Exam Session *</label>
                  <select required value={examSession} onChange={(e) => setExamSession(e.target.value)} className={input}>
                    <option value="">Select...</option>
                    {EXAM_SESSIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Parent / Guardian Name *</label>
                  <input type="text" required value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="e.g. Mr. Shahzaib Khan" className={input} />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">WhatsApp Phone *</label>
                  <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 0000000" className={input} />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" className={input} />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className={input} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-700 block mb-1">Address</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street / area" className={input} />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100">
                <button type="submit" disabled={submitting} className="w-full py-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-extrabold text-sm shadow-lg shadow-[#5B47D6]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                  <span>{submitting ? 'Submitting...' : 'Complete Enrollment'}</span>
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white border border-[#EBEDF3] rounded-[24px] p-8 shadow-xl text-center space-y-5 max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <h2 className="font-heading font-extrabold text-2xl text-slate-900">Enrollment Complete!</h2>
            <p className="text-xs text-[#6B7185] font-medium max-w-md mx-auto">
              Thank you! <strong className="text-slate-900">{studentName}</strong> is now enrolled. Our team will confirm the fee and share the class schedule (with Google Meet links) shortly.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-[#EBEDF3] py-4 text-center text-xs text-slate-400 font-medium">
        Thinkerzz Academy Operating System (EOS v3.1) · All rights reserved.
      </footer>
    </div>
  );
}
