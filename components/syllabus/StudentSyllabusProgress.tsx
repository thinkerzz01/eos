'use client';

// Staff-facing syllabus progress for one student (student profile → Academics).
// Read + MARK: a teacher/admin can tick subtopics covered here, independent of a
// class session (session_id stays null; date + teacher are still stamped). RLS
// restricts a teacher to their own students. The student's own /my-syllabus view
// stays read-only (it renders the same cards without onToggle).
import React, { useEffect, useState } from 'react';
import type { MySubject } from '@/lib/data/studentSyllabus';
import { SyllabusProgressCards } from './SyllabusProgressCards';
import { loadStudentSyllabus } from '@/app/students/syllabusProgress';
import { setSubtopicCoverage } from '@/app/schedule/syllabusCoverage';
import { useToast } from '@/components/ui/Toast';
import { Loader2 } from 'lucide-react';

function pktToday(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function StudentSyllabusProgress({ studentId }: { studentId: string }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<MySubject[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadStudentSyllabus(studentId)
      .then((s) => { if (alive) { setSubjects(s); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

  // Immutably flip one item's covered state across the nested structure.
  const patchItem = (itemId: string, covered: boolean) =>
    setSubjects((prev) => prev.map((s) => ({
      ...s,
      topics: s.topics.map((t) => ({
        ...t,
        items: t.items.map((i) => (i.id === itemId ? { ...i, covered, coveredOn: covered ? pktToday() : null } : i)),
      })),
    })));

  const onToggle = async (itemId: string, covered: boolean) => {
    patchItem(itemId, covered); // optimistic
    setSaving((m) => ({ ...m, [itemId]: true }));
    const res = await setSubtopicCoverage({ itemId, covered, sessionId: null });
    setSaving((m) => ({ ...m, [itemId]: false }));
    if (!res.ok) {
      patchItem(itemId, !covered); // revert
      showToast(res.error ?? 'Could not save.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading syllabus progress…
      </div>
    );
  }
  if (!subjects.length) {
    return (
      <div className="text-center text-[#6B7185] py-8 text-xs font-medium">
        No syllabus progress yet. It appears once this subject has an outline and a snapshot is generated for the student.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">Tap a subtopic to mark it covered. Changes save instantly.</p>
      <SyllabusProgressCards subjects={subjects} onToggle={onToggle} saving={saving} />
    </div>
  );
}
