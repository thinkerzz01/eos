'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { UserCheck, ShieldAlert } from 'lucide-react';
import { createTeacher } from '@/app/teachers/actions';
import { ALL_PROGRAMS, ALL_SUBJECTS } from '@/lib/syllabiSeed';
import { listSubjects, type SubjectPick } from '@/app/subjects/actions';

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddTeacherModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTeacherModalProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Live DB subjects (managed on the Subjects screen). Fall back to the built-in
  // list only when the DB has none yet, so the form always shows something.
  const [dbSubjects, setDbSubjects] = useState<SubjectPick[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    listSubjects().then((s) => { if (alive) setDbSubjects(s); }).catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);
  const subjectNames = useMemo(() => {
    const names = Array.from(new Set(dbSubjects.map((s) => s.name)));
    return names.length ? names.sort() : ([...ALL_SUBJECTS] as string[]);
  }, [dbSubjects]);
  const programList = useMemo(() => {
    const progs = Array.from(new Set(dbSubjects.map((s) => s.program)));
    return progs.length ? progs.sort() : ([...ALL_PROGRAMS] as string[]);
  }, [dbSubjects]);

  // NO PRE-FILLED DEFAULT VALUES - ONLY PLACEHOLDERS
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    capacity: '', // Typed per teacher
    join_date: '',
    selectedSubjects: [] as string[],
    selectedPrograms: [] as string[],
  });

  const toggleSubject = (subj: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedSubjects: prev.selectedSubjects.includes(subj)
        ? prev.selectedSubjects.filter((s) => s !== subj)
        : [...prev.selectedSubjects, subj],
    }));
  };

  const toggleProgram = (prog: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedPrograms: prev.selectedPrograms.includes(prog)
        ? prev.selectedPrograms.filter((p) => p !== prog)
        : [...prev.selectedPrograms, prog],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.capacity) {
      showToast('Please fill in Name, Phone, and Capacity.', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await createTeacher({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        capacity: formData.capacity,
        joinDate: formData.join_date,
        subjects: formData.selectedSubjects,
        programs: formData.selectedPrograms,
      });

      if (res.ok) {
        if (res.warning) {
          showToast(res.warning, 'error');
        } else {
          showToast(`Teacher ${formData.name} added. A portal invite was emailed to set their password.`, 'success');
        }
        onSuccess?.();
        router.refresh();
        onClose();
      } else {
        showToast(res.error ?? 'Failed to add teacher.', 'error');
      }
    } catch (err) {
      showToast('Failed to add teacher.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Teacher"
      subtitle="Fill in teacher profile. Fields have clear placeholders and spacious layout."
      maxWidth="xl"
      footerButtons={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="addTeacherForm"
            disabled={loading}
            className="px-6 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>{loading ? 'Adding...' : 'Add Teacher'}</span>
          </button>
        </>
      }
    >
      <form id="addTeacherForm" onSubmit={handleSubmit} className="space-y-5 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Teacher Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Sir Usman Farooq"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>

          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. usman@thinkerzz.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>

          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Phone Number *
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. +92 302 5556667"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>

          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g. Karachi"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>

          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Teacher Capacity (Max Active Students) *
            </label>
            <input
              type="number"
              required
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="e.g. 20 (Typed per teacher)"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6] font-mono font-medium"
            />
          </div>

          <div>
            <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-1.5">
              Join Date
            </label>
            <input
              type="date"
              value={formData.join_date}
              onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#5B47D6]"
            />
          </div>
        </div>

        {/* Teaching Programs */}
        <div>
          <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-2">
            Teaching Programs (All 7 Programs)
          </label>
          <div className="flex flex-wrap gap-2">
            {programList.map((prog) => {
              const isSel = formData.selectedPrograms.includes(prog);
              return (
                <button
                  type="button"
                  key={prog}
                  onClick={() => toggleProgram(prog)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                    isSel
                      ? 'bg-[#5B47D6] text-white border-[#5B47D6] shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {prog}
                </button>
              );
            })}
          </div>
        </div>

        {/* Teaching Subjects */}
        <div>
          <label className="block font-medium text-xs text-slate-700 dark:text-slate-300 mb-2">
            Teaching Subjects (CAIE, Matric & Inter)
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
            {subjectNames.map((subj) => {
              const isSel = formData.selectedSubjects.includes(subj);
              return (
                <button
                  type="button"
                  key={subj}
                  onClick={() => toggleSubject(subj)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    isSel
                      ? 'bg-[#5B47D6] text-white border-[#5B47D6] shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {subj}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-2 text-xs text-[#5B47D6] dark:text-purple-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>New teacher track record metrics (Rating, Demos, Reliability) initialize to 0 and render as <strong>"New"</strong> until earned.</span>
        </div>
      </form>
    </Modal>
  );
}
