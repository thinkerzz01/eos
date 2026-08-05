'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { HomeworkAssignment } from '@/lib/mockAcademicsData';
import type { SubjectOption } from '@/lib/data/subjects';
import { createHomework, gradeHomework } from './actions';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  UserCheck,
  X,
  FileCheck,
  Award,
} from 'lucide-react';

export function HomeworkClient({
  initialHomeworks,
  students,
  teachers,
  subjects,
}: {
  initialHomeworks: HomeworkAssignment[];
  students: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  subjects: SubjectOption[];
}) {
  const { role } = useRole();
  const router = useRouter();
  const [homeworks, setHomeworks] = useState<HomeworkAssignment[]>(initialHomeworks);
  const [showAddHomeworkModal, setShowAddHomeworkModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Keep the list in sync when the server refetches after a write (router.refresh()).
  useEffect(() => { setHomeworks(initialHomeworks); }, [initialHomeworks]);

  const handleAddHomework = async () => {
    if (!title || !studentId || !subjectId || !teacherId || !deadline) {
      alert('Title, student, subject, teacher, and deadline are all required.');
      return;
    }
    setAssigning(true);
    const res = await createHomework({ studentId, subjectId, teacherId, title, deadline });
    setAssigning(false);

    if (res.ok) {
      setShowAddHomeworkModal(false);
      setTitle('');
      setStudentId('');
      setSubjectId('');
      setTeacherId('');
      setDeadline('');
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to assign homework.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin', 'manager', 'teacher', 'student']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Homework & Assignments Management</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Assign homework and track student submissions (feeds into 30% Homework Completion health metric).
            </p>
          </div>

          <button
            onClick={() => setShowAddHomeworkModal(true)}
            className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Assign Homework</span>
          </button>
        </div>

        {/* HOMEWORK DATA TABLE */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#F6F7FB] dark:bg-slate-800/90 border-b border-[#EBEDF3] dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-[11.5px]">
                  <th className="py-3.5 px-3">HOMEWORK CODE & TITLE</th>
                  <th className="py-3.5 px-3">SUBJECT & PROGRAM</th>
                  <th className="py-3.5 px-3">TEACHER</th>
                  <th className="py-3.5 px-3">ASSIGNED & DUE DATE</th>
                  <th className="py-3.5 px-3">SUBMISSIONS</th>
                  <th className="py-3.5 px-3">STATUS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F2F7] dark:divide-slate-800 text-xs font-medium">
                {homeworks.map((hw) => (
                  <tr key={hw.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{hw.title}</div>
                      <div className="text-[11px] text-[#6B7185] font-mono">{hw.homeworkCode}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-slate-900 dark:text-slate-100">{hw.subject}</div>
                      <div className="text-[11px] text-[#6B7185]">{hw.program}</div>
                    </td>

                    <td className="py-3.5 px-3 font-extrabold text-slate-900 dark:text-slate-100">
                      {hw.teacherName}
                    </td>

                    <td className="py-3.5 px-3 font-mono">
                      <div>Assigned: {hw.assignedDate}</div>
                      <div className="text-rose-600 font-bold">Due: {hw.dueDate}</div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-slate-900">{hw.gradedCount} / {hw.totalSubmissions} Graded</div>
                      <div className="text-[10.5px] text-emerald-600 font-bold">
                        {Math.round((hw.gradedCount / (hw.totalSubmissions || 1)) * 100)}% On-time Completion
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          hw.status === 'Graded' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-[#5B47D6]'
                        }`}
                      >
                        {hw.status}
                      </span>
                      {hw.status !== 'Graded' && role !== 'student' && (
                        <button
                          onClick={async () => {
                            const res = await gradeHomework({ homeworkId: hw.id });
                            if (res.ok) router.refresh();
                            else alert(res.error ?? 'Failed to grade.');
                          }}
                          className="mt-1 block text-[10.5px] text-[#5B47D6] font-bold hover:underline cursor-pointer"
                        >
                          Mark graded →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ADD HOMEWORK MODAL */}
        {showAddHomeworkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-heading font-extrabold text-slate-900 dark:text-white text-base">+ Assign New Homework</h3>
                <button onClick={() => setShowAddHomeworkModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Homework Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Vectors & Calculus Worksheet" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Student</label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                    <option value="">Select a student...</option>
                    {students.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Subject</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.program})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Teacher</label>
                    <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100">
                      <option value="">Select...</option>
                      {teachers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-slate-900 dark:text-slate-100" />
                </div>
                {(students.length === 0 || subjects.length === 0 || teachers.length === 0) && (
                  <p className="text-[10.5px] text-amber-600 font-medium">Add students, subjects, and teachers first (run supabase/seed_subjects.sql for subjects).</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowAddHomeworkModal(false)} className="px-4 py-2 border rounded-xl font-bold text-xs">Cancel</button>
                <button onClick={handleAddHomework} disabled={assigning} className="px-4 py-2 bg-[#5B47D6] text-white rounded-xl font-extrabold text-xs shadow-md disabled:opacity-50">{assigning ? 'Assigning...' : 'Assign Homework'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </PortalLayout>
  );
}
