'use client';

// Premium multi-step student onboarding. The academy sends /onboarding/<studentId>
// after a won demo; the student completes their record over 3 steps. The link is
// keyed to a random UUID, so a tampered URL simply fails to match and shows an
// "invalid / expired" state; a finished form shows "already completed".
import React, { useEffect, useMemo, useState } from 'react';
import { getOnboardingContext, submitOnboarding } from './actions';
import { TurnstileWidget } from '@/components/security/TurnstileWidget';
import {
  CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, User, Users,
  ShieldCheck, MessageCircle, GraduationCap, CalendarClock,
} from 'lucide-react';

const HELP_WA = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || '923000000000').replace(/\D/g, '');

const GRADES = [
  'O Level (O1)', 'O Level (O2)', 'A Level (A1)', 'A Level (A2)', 'IGCSE',
  'Matric (9)', 'Matric (10)', 'Inter (11)', 'Inter (12)',
];
const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Night'];

const STEPS = [
  { n: 1, title: 'Student Details', desc: 'Basic Information About The Student', icon: User },
  { n: 2, title: 'Parent & Contact', desc: 'Guardian And Address Details', icon: Users },
  { n: 3, title: 'Preferences & Consent', desc: 'Subjects, Timing And Agreement', icon: CalendarClock },
];

export default function OnboardingPage({ params }: { params: { studentId: string } }) {
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState('');
  const [name, setName] = useState('');
  const [program, setProgram] = useState('');
  const [examSession, setExamSession] = useState('');
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Step 1 - student
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  // Step 2 - parent + contact
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentWhatsapp, setParentWhatsapp] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentOccupation, setParentOccupation] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  // Step 3 - preferences + consent
  const [subjects, setSubjects] = useState('');
  const [previousResult, setPreviousResult] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('Evening');
  const [preferredTime, setPreferredTime] = useState('');
  const [notes, setNotes] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    let active = true;
    getOnboardingContext(params.studentId).then((ctx) => {
      if (!active) return;
      if (!ctx.ok) {
        setInvalid(ctx.error ?? 'This link is invalid.');
      } else {
        // Pre-fill everything we already know from the demo booking.
        setName(ctx.name ?? '');
        setFullName(ctx.name ?? '');
        setProgram(ctx.program ?? '');
        setExamSession(ctx.examSession ?? '');
        setParentName(ctx.parentName ?? '');
        setParentWhatsapp(ctx.phone ?? '');
        setParentEmail(ctx.email ?? '');
        setAlreadyDone(!!ctx.alreadyDone);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [params.studentId]);

  const progress = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  const goNext = () => {
    setError('');
    if (step === 1) {
      if (!studentEmail.trim() || !/^\S+@\S+\.\S+$/.test(studentEmail.trim())) {
        setError('Please enter a valid Student Email address.');
        return;
      }
      if (!studentMobile.trim()) {
        setError('Please enter the Student Mobile number.');
        return;
      }
    }
    if (step === 2 && !parentWhatsapp.trim()) {
      setError('Please enter the Parent WhatsApp number so we can reach you.');
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };
  const goBack = () => { setError(''); setStep((s) => Math.max(1, s - 1)); };

  const handleSubmit = async () => {
    setError('');
    if (!parentWhatsapp.trim()) { setStep(2); setError('Parent WhatsApp number is required.'); return; }
    if (!agreed) { setError('Please accept the privacy policy and code of conduct to continue.'); return; }
    setSubmitting(true);
    try {
      const res = await submitOnboarding({
        studentId: params.studentId,
        whatsapp: parentWhatsapp, // parent WhatsApp = the primary contact
        email: parentEmail,
        city,
        address,
        gender,
        dob,
        data: {
          fullName, studentEmail, studentMobile, grade, school,
          parentName, parentPhone, parentOccupation,
          subjects, previousResult, timeOfDay, preferredTime, notes,
          agreedToPolicy: 'yes',
        },
        turnstileToken,
      });
      if (!res.ok) { setError(res.error || 'Something went wrong. Please try again.'); return; }
      setDone(true);
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const plain = 'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5B47D6] focus:ring-2 focus:ring-[#5B47D6]/15 transition';
  const label = 'block text-xs font-bold text-slate-700 mb-1.5';


  if (loading) return <Shell><p className="text-center text-sm text-slate-500 py-20">Loading...</p></Shell>;

  if (invalid)
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-sm text-center space-y-3 max-w-lg mx-auto mt-10">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="font-heading font-extrabold text-2xl text-slate-900">Link Not Valid</h2>
          <p className="text-sm text-slate-500">{invalid}</p>
          <a href={`https://wa.me/${HELP_WA}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
            <MessageCircle className="w-4 h-4" /> Contact the academy on WhatsApp
          </a>
        </div>
      </Shell>
    );

  if (done || alreadyDone)
    return (
      <Shell>
        <div className="bg-white border border-slate-200 rounded-3xl p-10 shadow-lg text-center space-y-4 max-w-xl mx-auto mt-8 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-11 h-11 stroke-[2.5]" />
          </div>
          <h2 className="font-heading font-extrabold text-3xl text-slate-900">
            {alreadyDone && !done ? 'Admission Already Completed' : `You're All Set${name ? ', ' + name : ''}!`}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Thank you for completing your admission. Our team will review your details and set up your
            classes and portal access. We will reach out to you on WhatsApp shortly with the next steps.
          </p>
          <a href={`https://wa.me/${HELP_WA}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-bold shadow-md transition">
            <MessageCircle className="w-4 h-4" /> Message Us on WhatsApp
          </a>
        </div>
      </Shell>
    );

  return (
    <Shell>
      {/* Progress bar */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
          <span>Admission Progress</span>
          <span>Step {step} of {STEPS.length} · {progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full bg-[#5B47D6] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 max-w-6xl mx-auto">
        {/* Sidebar */}
        <aside className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm h-fit lg:sticky lg:top-24">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-full bg-[#5B47D6] text-white flex items-center justify-center font-extrabold">
              {(name || 'S').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Welcome Aboard,</div>
              <div className="font-heading font-extrabold text-lg text-slate-900 leading-tight">{name || 'Student'}!</div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = s.n === step;
              const complete = s.n < step;
              return (
                <button key={s.n} type="button" onClick={() => s.n < step && setStep(s.n)}
                  className={`w-full flex items-start gap-3 text-left rounded-2xl p-3 transition ${active ? 'bg-[#5B47D6]/10 border border-[#5B47D6]/20' : complete ? 'hover:bg-slate-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-[#5B47D6] text-white' : complete ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {complete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className={`text-sm font-extrabold ${active ? 'text-[#5B47D6]' : 'text-slate-800'}`}>{s.n}. {s.title}</div>
                    <div className="text-xs text-slate-500 font-medium">{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 border border-slate-100 p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-700">Your Data Is Secure.</span> We use industry-standard security to protect your information.
            </div>
          </div>
        </aside>

        {/* Content */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <>
              <StepHead icon={<User className="w-5 h-5" />} title="Student Details" sub="Let's Start With Some Basic Information About The Student." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Student Full Name</label>
                  <div className="relative"><User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Hamza Ali Khan" className={field} /></div>
                </div>
                <div>
                  <label className={label}>Date Of Birth</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={plain} />
                </div>
                <div>
                  <label className={label}>Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={plain}>
                    <option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Student Email <span className="text-rose-500">*</span></label>
                  <input type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="e.g. hamza@example.com" className={plain} />
                </div>
                <div>
                  <label className={label}>Student Mobile Number <span className="text-rose-500">*</span></label>
                  <input inputMode="tel" value={studentMobile} onChange={(e) => setStudentMobile(e.target.value)} placeholder="+92 300 0000000" className={plain} />
                </div>
                <div>
                  <label className={label}>Current Grade / Class</label>
                  <select value={grade} onChange={(e) => setGrade(e.target.value)} className={plain}>
                    <option value="">Select Current Grade Or Class</option>
                    {GRADES.map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Current School / Institution</label>
                  <div className="relative"><GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Beaconhouse School System" className={field} /></div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHead icon={<Users className="w-5 h-5" />} title="Parent & Contact" sub="Who Should We Contact, And Where Do You Live?" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Parent / Guardian Name</label>
                  <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="e.g. Mr. Shahzaib Khan" className={plain} />
                </div>
                <div>
                  <label className={label}>Parent Phone Number</label>
                  <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+92 300 0000000" className={plain} />
                </div>
                <div>
                  <label className={label}>Parent WhatsApp Number <span className="text-rose-500">*</span></label>
                  <div className="relative"><MessageCircle className="w-4 h-4 text-emerald-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input value={parentWhatsapp} onChange={(e) => setParentWhatsapp(e.target.value)} placeholder="+92 300 0000000" className={field} /></div>
                </div>
                <div>
                  <label className={label}>Parent Email (Optional)</label>
                  <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="e.g. parent@example.com" className={plain} />
                </div>
                <div>
                  <label className={label}>Parent Occupation (Optional)</label>
                  <input value={parentOccupation} onChange={(e) => setParentOccupation(e.target.value)} placeholder="e.g. Businessman" className={plain} />
                </div>
                <div>
                  <label className={label}>City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lahore" className={plain} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Full Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House Number, Street, Area, City" className={plain} />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHead icon={<CalendarClock className="w-5 h-5" />} title="Preferences & Consent" sub="Tell Us What You Want To Study And When You Prefer Classes." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={label}>Subjects You Want To Study</label>
                  <input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="e.g. Physics, Chemistry, Mathematics" className={plain} />
                </div>
                <div>
                  <label className={label}>Previous Result / Percentage (Optional)</label>
                  <input value={previousResult} onChange={(e) => setPreviousResult(e.target.value)} placeholder="e.g. 82% or A grade" className={plain} />
                </div>
                <div>
                  <label className={label}>Preferred Time Of Day</label>
                  <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className={plain}>
                    {TIMES_OF_DAY.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>What Time Suits You Best For Class?</label>
                  <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} placeholder="e.g. Around 5:00 PM, or after 7:00 PM" className={plain} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>Anything Else We Should Know? (Optional)</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requirements, medical notes, or preferences" className={plain} />
                </div>
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#5B47D6]/5 border border-[#5B47D6]/15 p-3.5 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#5B47D6]" />
                <span className="text-xs font-semibold text-slate-700 leading-relaxed">
                  I Agree To Thinkerzz's{' '}
                  <a href="https://thinkerzz.com/privacy-policy/" target="_blank" rel="noreferrer" className="text-[#5B47D6] underline">Privacy Policy</a>
                  {' '}And Class Code Of Conduct, And Confirm The Information Above Is Correct.
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="mt-5 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          {step === STEPS.length && (
            <div className="mt-4"><TurnstileWidget onToken={setTurnstileToken} /></div>
          )}

          <div className="mt-6 flex items-center justify-between pt-5 border-t border-slate-100">
            <button type="button" onClick={goBack} disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {step < STEPS.length ? (
              <button type="button" onClick={goNext}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#5B47D6] hover:bg-[#4F3DC7] transition">
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Onboarding'} {!submitting && <CheckCircle2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-slate-400 font-medium mt-6">
        {program ? <>Program: <strong className="text-slate-500">{program}</strong>{examSession ? <> · Exam Session: <strong className="text-slate-500">{examSession}</strong></> : null} · </> : null}
        Takes About 2 Minutes · Thinkerzz
      </p>
    </Shell>
  );
}

function StepHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-2xl bg-[#5B47D6]/10 text-[#5B47D6] flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-slate-900 tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 font-medium">{sub}</p>
      </div>
    </div>
  );
}

// Module-level so it is NOT recreated on every keystroke (that remounts the tree
// and makes inputs lose focus). Page chrome + WhatsApp help header.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-[#171A2B] font-sans">
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 py-3.5 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo-light.png" alt="Thinkerzz" className="h-8 w-auto object-contain" />
            <span className="hidden sm:inline text-xs font-extrabold tracking-wider uppercase text-[#5B47D6] border-l border-slate-200 pl-3">Student Admission</span>
          </div>
          <a href={`https://wa.me/${HELP_WA}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100 transition">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-bold">Need Help? Chat on WhatsApp</span>
          </a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
