'use client';

// Staff-facing wrapper: loads a specific student's syllabus progress (read-only)
// and renders the shared progress cards. Used in the student profile's Academics
// tab. RLS restricts what a teacher can load to their own students.
import React, { useEffect, useState } from 'react';
import type { MySubject } from '@/lib/data/studentSyllabus';
import { SyllabusProgressCards } from './SyllabusProgressCards';
import { loadStudentSyllabus } from '@/app/students/syllabusProgress';
import { Loader2 } from 'lucide-react';

export function StudentSyllabusProgress({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<MySubject[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadStudentSyllabus(studentId)
      .then((s) => { if (alive) { setSubjects(s); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [studentId]);

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
        No syllabus progress yet. It appears once this subject has an outline and the teacher marks coverage in class.
      </div>
    );
  }
  return <SyllabusProgressCards subjects={subjects} />;
}
