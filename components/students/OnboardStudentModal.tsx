'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { UserPlus } from 'lucide-react';
import { createStudent } from '@/app/students/actions';
import {
  ALL_PROGRAMS,
  ALL_SUBJECTS,
  EXAM_SESSIONS,
  LEAD_SOURCES,
} from '@/lib/syllabiSeed';

interface OnboardStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function OnboardStudentModal({
  isOpen,
  onClose,
  onSuccess,
}: OnboardStudentModalProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // NO PRE-FILLED DEFAULTS — ONLY PLACEHOLDERS
  const [formData, setFormData] = useState({
    name: '',
    parent_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    gender: '' as '' | 'female' | 'male' | 'other',
    program: '' as string,
    exam_session: '',
    enrolled_at: '',
    months_committed: '',
    status: 'active' as 'active' | 'paused' | 'stopped',
    monthly_fee: '',
    fee_status: '' as '' | 'paid' | 'due' | 'in_grace' | 'stopped',
    next_due_date: '',
    source: '' as string,
    selectedSubjects: [] as string[],
  });

  const toggleSubject = (subj: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subj)
        ? prev.selectedSubjects.filter((s) => s !== subj)
        : [...prev.selectedSubjects, subj],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.parent_name || !formData.phone || !formData.program) {
      showToast('Please fill in required fields (Name, Parent, Phone, Program).', 'error');
      return;
    }
    if (!formData.exam_session || !formData.monthly_fee || !formData.next_due_date) {
      showToast('Exam session, monthly fee, and next due date are required.', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await createStudent({
        name: formData.name,
        parent_name: formData.parent_name,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        gender: formData.gender,
        program: formData.program,
        exam_session: formData.exam_session,
        enrolled_at: formData.enrolled_at,
        months_committed: formData.months_committed,
        monthly_fee: formData.monthly_fee,
        fee_status: formData.fee_status,
        next_due_date: formData.next_due_date,
        source: formData.source,
      });

      if (res.ok) {
        if (res.warning) {
          showToast(res.warning, 'error');
        } else {
          showToast(`Student ${formData.name} onboarded successfully!`, 'success');
        }
        onSuccess?.();
        router.refresh(); // re-fetch the server component so the new row appears
        onClose();
      } else {
        showToast(res.error ?? 'Failed to onboard student.', 'error');
      }
    } catch (err) {
      showToast('Failed to onboard student.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Student"
      subtitle="Complete student profile. Fields have clear placeholders and spacious layout."
      maxWidth="2xl"
      footerButtons={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="onboardForm"
            disabled={loading}
            className="px-6 py-2.5 bg-[#5A31F4] hover:bg-[#3B1CCF] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Onboarding...' : 'Onboard Student'}</span>
          </button>
        </>
      }
    >
      <form id="onboardForm" onSubmit={handleSubmit} className="space-y-5 text-sm">
        {/* Row 1: Name, Parent Name, Phone, WhatsApp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Student Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ahmed Raza"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Parent / Guardian Name *
            </label>
            <input
              type="text"
              required
              value={formData.parent_name}
              onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
              placeholder="e.g. Mr. Raza Khan"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Phone Number *
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. +92 300 1234567"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              WhatsApp Number
            </label>
            <input
              type="text"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="e.g. +92 300 1234567"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>
        </div>

        {/* Row 2: Email, Address, City (Plain Text Input!), Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. ahmed@gmail.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g. Karachi"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Block 5, Gulshan"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Gender (Pronoun Merge)
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              <option value="">Select Gender...</option>
              <option value="female">Female (she/her)</option>
              <option value="male">Male (he/him)</option>
              <option value="other">Other (they/them)</option>
            </select>
          </div>
        </div>

        {/* Row 3: Program (All 7 Programs), Exam Session, Enrolled Date, Months Committed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Program *
            </label>
            <select
              required
              value={formData.program}
              onChange={(e) => setFormData({ ...formData, program: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              <option value="">Select Program...</option>
              {ALL_PROGRAMS.map((prog) => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Exam Session
            </label>
            <select
              value={formData.exam_session}
              onChange={(e) => setFormData({ ...formData, exam_session: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              <option value="">Select Exam Session...</option>
              {EXAM_SESSIONS.map((ses) => (
                <option key={ses} value={ses}>{ses}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Enrolled Date
            </label>
            <input
              type="date"
              value={formData.enrolled_at}
              onChange={(e) => setFormData({ ...formData, enrolled_at: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Months Committed
            </label>
            <input
              type="number"
              value={formData.months_committed}
              onChange={(e) => setFormData({ ...formData, months_committed: e.target.value })}
              placeholder="e.g. 6"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4] font-mono font-bold"
            />
          </div>
        </div>

        {/* Row 4: Monthly Fee, Fee Status, Next Due Date, Lead Source */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Monthly Fee (PKR)
            </label>
            <input
              type="number"
              value={formData.monthly_fee}
              onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
              placeholder="e.g. 20000"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4] font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Fee Status
            </label>
            <select
              value={formData.fee_status}
              onChange={(e) => setFormData({ ...formData, fee_status: e.target.value as any })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              <option value="">Select Fee Status...</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
              <option value="in_grace">In Grace</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Next Due Date
            </label>
            <input
              type="date"
              value={formData.next_due_date}
              onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            />
          </div>

          <div>
            <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Lead Source
            </label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5A31F4]"
            >
              <option value="">Select Lead Source...</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subjects Selection (CAIE + Local Board) */}
        <div>
          <label className="block font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">
            Select Enrolled Subjects (CAIE, Matric & Inter)
          </label>
          <div className="flex flex-wrap gap-2.5 max-h-44 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            {ALL_SUBJECTS.map((subj) => {
              const isSel = formData.selectedSubjects.includes(subj);
              return (
                <button
                  type="button"
                  key={subj}
                  onClick={() => toggleSubject(subj)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSel
                      ? 'bg-[#5A31F4] text-white border-[#5A31F4] shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {subj}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
