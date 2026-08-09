'use client';

// Public student onboarding form. The academy sends /onboarding/<studentId> after a
// won demo; the student completes the fuller record. Draft form - fields are easy to
// adjust once the owner confirms exactly what to collect.
import React, { useEffect, useState } from 'react';
import { getOnboardingContext, submitOnboarding } from './actions';
import { CheckCircle2, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';

export default function OnboardingPage({ params }: { params: { studentId: string } }) {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState('');
  const [name, setName] = useState('');
  const [program, setProgram] = useState('');
  const [examSession, setExamSession] = useState('');
  const [alreadyDone, setAlreadyDone] = useState(false);

  // Editable fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [cnic, setCnic] = useState('');
  const [school, setSchool] = useState('');
  const [subjects, setSubjects] = useState('');
  const [relationship, setRelationship] = useState('');
  const [parentOccupation, setParentOccupation] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    getOnboardingContext(params.studentId).then((ctx) => {
      if (!active) return;
      if (!ctx.ok) {
        setInvalid(ctx.error ?? 'This onboarding link is invalid.');
      } else {
        setName(ctx.name ?? '');
        setProgram(ctx.program ?? '');
        setExamSession(ctx.examSession ?? '');
        setAlreadyDone(!!ctx.alreadyDone);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [params.studentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!whatsapp) {
      setError('Please enter a WhatsApp number so the academy can reach you.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitOnboarding({
        studentId: params.studentId,
        whatsapp,
        email,
        city,
        address,
        gender,
        dob,
        data: {
          cnic,
          school,
          subjects,
          relationship,
          parentOccupation,
          emergencyName,
          emergencyPhone,
          notes,
        },
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

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-[#F8F9FD] text-[#171A2B] font-sans flex flex-col justify-between">
      <header className="bg-white border-b border-[#EBEDF3] py-4 px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-heading font-black text-xl shadow-md">
            T
          </div>
          <div>
            <div className="font-heading font-extrabold text-xl tracking-tight text-slate-900">THINKERZZ ACADEMY</div>
            <div className="text-xs font-bold text-[#5B47D6] tracking-wider uppercase">Student Onboarding</div>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">{children}</main>
      <footer className="border-t border-[#EBEDF3] py-4 text-center text-xs text-slate-400 font-medium">
        Thinkerzz Academy Operating System (EOS v3.1) · All rights reserved.
      </footer>
    </div>
  );

  if (loading) return <Shell><p className="text-center text-sm text-slate-500">Loading...</p></Shell>;

  if (invalid)
    return (
      <Shell>
        <div className="bg-white border border-[#EBEDF3] rounded-[24px] p-8 shadow-xl text-center space-y-3 max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Link not valid</h2>
          <p className="text-sm text-slate-500">{invalid}</p>
        </div>
      </Shell>
    );

  if (done || alreadyDone)
    return (
      <Shell>
        <div className="bg-white border border-[#EBEDF3] rounded-[24px] p-8 shadow-xl text-center space-y-5 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-slate-900">
            {alreadyDone && !done ? 'Onboarding already completed' : 'Onboarding complete!'}
          </h2>
          <p className="text-xs text-[#6B7185] font-medium max-w-md mx-auto">
            Thank you{name ? `, ${name}` : ''}! Your details are saved. The academy will set up your fee, class
            schedule, and portal access. If anything changes, contact the academy.
          </p>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="px-3.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-full inline-flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Welcome to Thinkerzz - Complete Your Onboarding</span>
          </span>
          <h1 className="font-heading font-extrabold text-3xl text-slate-900 tracking-tight">
            {name ? `${name}'s Onboarding` : 'Student Onboarding'}
          </h1>
          <p className="text-sm text-[#6B7185] font-medium leading-relaxed">
            {program ? <>Program: <strong>{program}</strong>{examSession ? <> · Exam session: <strong>{examSession}</strong></> : null}. </> : null}
            Please fill in the details below so we can set up classes and your portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#EBEDF3] rounded-[24px] p-6 sm:p-8 shadow-xl space-y-6 text-xs font-bold">
          {/* STUDENT */}
          <div className="space-y-3">
            <div className="text-sm font-heading font-extrabold text-slate-900 uppercase tracking-wider">Student Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">Date of Birth</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={input} />
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
                <label className="text-slate-700 block mb-1">B-Form / CNIC Number</label>
                <input type="text" value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="00000-0000000-0" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Current School / Institution</label>
                <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Beaconhouse" className={input} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-700 block mb-1">Subjects You Want to Study</label>
                <input type="text" value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="e.g. Physics, Chemistry, Mathematics" className={input} />
              </div>
            </div>
          </div>

          {/* PARENT / GUARDIAN */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="text-sm font-heading font-extrabold text-slate-900 uppercase tracking-wider">Parent / Guardian</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">Relationship</label>
                <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Father / Mother / Guardian" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Parent Occupation</label>
                <input type="text" value={parentOccupation} onChange={(e) => setParentOccupation(e.target.value)} placeholder="e.g. Businessman" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">WhatsApp Number *</label>
                <input type="text" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+92 300 0000000" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" className={input} />
              </div>
            </div>
          </div>

          {/* CONTACT & EMERGENCY */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="text-sm font-heading font-extrabold text-slate-900 uppercase tracking-wider">Contact & Emergency</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Full Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street / area" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Emergency Contact Name</label>
                <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="e.g. Uncle Ahmed" className={input} />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Emergency Contact Phone</label>
                <input type="text" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+92 300 0000000" className={input} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-700 block mb-1">Anything else we should know?</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Special requirements, medical notes, preferred timings, etc." className={input} />
              </div>
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
              <span>{submitting ? 'Saving...' : 'Submit Onboarding Details'}</span>
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
