'use client';

// My Syllabus (student, read-only). Progress through each enrolled subject. The
// cards are shared with the staff student-profile view (SyllabusProgressCards).
import React from 'react';
import { PortalLayout } from '@/components/layout/PortalLayout';
import type { MySubject } from '@/lib/data/studentSyllabus';
import { SyllabusProgressCards } from '@/components/syllabus/SyllabusProgressCards';
import { ListChecks, BookOpen } from 'lucide-react';

export function MySyllabusClient({ subjects }: { subjects: MySubject[] }) {
  return (
    <PortalLayout title="" subtitle="" allowedRoles={['student']}>
      <div className="space-y-5 max-w-3xl pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-[#5B47D6]" /> My Syllabus
          </h1>
          <p className="text-sm text-[#6B7185]">Your progress through each subject. A subtopic turns green once your teacher marks it covered in class.</p>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-[#D9DCE8] dark:border-slate-700 rounded-2xl p-10 text-center text-slate-500">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No syllabus progress yet. Once your teacher starts marking coverage in your classes, it will show up here.
          </div>
        ) : (
          <SyllabusProgressCards subjects={subjects} />
        )}
      </div>
    </PortalLayout>
  );
}
