'use client';

import React, { useState } from 'react';
import { MOCK_OPEN_SLOTS } from '@/lib/mockAdmissionsData';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  User,
  Phone,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

export default function PublicBookingPage() {
  const [selectedSlotId, setSelectedSlotId] = useState<string>(MOCK_OPEN_SLOTS[0]?.id ?? '');
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [program, setProgram] = useState('O Level');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  const selectedSlot = MOCK_OPEN_SLOTS.find((s) => s.id === selectedSlotId);

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !parentName || !parentPhone) return;

    // Simulates SECURITY DEFINER create_public_booking DB call
    // Note: Public booking creates lead with NULL teacher per AGENTS.md §3.3
    const refCode = `THM-BOOK-${Math.floor(100000 + Math.random() * 900000)}`;
    setBookingRef(refCode);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#171A2B] font-sans flex flex-col justify-between">
      
      {/* PUBLIC HEADER */}
      <header className="bg-white border-b border-[#EBEDF3] py-4 px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5B47D6] to-[#8B7BF0] text-white flex items-center justify-center font-heading font-black text-xl shadow-md">
              T
            </div>
            <div>
              <div className="font-heading font-extrabold text-xl tracking-tight text-slate-900">THINKERZZ ACADEMY</div>
              <div className="text-[10.5px] font-bold text-[#5B47D6] tracking-wider uppercase">Question. Think. Achieve.</div>
            </div>
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
                Select an open slot below, enter your details, and instantly lock your free 1-on-1 demo trial class with our expert faculty.
              </p>
            </div>

            {/* FORM CARD */}
            <form onSubmit={handleSubmitBooking} className="bg-white border border-[#EBEDF3] rounded-[24px] p-6 sm:p-8 shadow-xl space-y-6">
              
              {/* STEP 1: SELECT OPEN TIME SLOT */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-heading font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  <div className="w-6 h-6 rounded-full bg-[#5B47D6] text-white flex items-center justify-center text-xs">1</div>
                  <span>Select Available Demo Time Slot</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MOCK_OPEN_SLOTS.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    return (
                      <div
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#5B47D6] bg-purple-50/70 shadow-sm'
                            : 'border-[#EBEDF3] hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{slot.subject} Demo</div>
                            <div className="text-xs text-[#5B47D6] font-bold mt-0.5">{slot.date}</div>
                            <div className="text-xs font-mono text-slate-600 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{slot.time}</span>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-[#5B47D6] shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
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
                      <option value="O Level">O Level (CAIE)</option>
                      <option value="A Level">A Level (CAIE)</option>
                      <option value="IGCSE">IGCSE</option>
                      <option value="Matric (10th)">Matric / F.Sc</option>
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
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-extrabold text-sm shadow-lg shadow-[#5B47D6]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Confirm Free Demo Booking</span>
                  <ArrowRight className="w-4 h-4" />
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
              <div className="text-purple-700 text-[11px] uppercase tracking-wider">Booking Reference Code</div>
              <div className="font-mono text-2xl text-[#5B47D6] font-extrabold">{bookingRef}</div>
              <div className="text-slate-600 text-[11.5px] font-medium pt-1">
                Selected Slot: <strong>{selectedSlot?.subject} Demo</strong> on <strong>{selectedSlot?.date} ({selectedSlot?.time})</strong>
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
        Thinkerzz Academy Operating System (EOS v3.1) · All rights reserved.
      </footer>

    </div>
  );
}
