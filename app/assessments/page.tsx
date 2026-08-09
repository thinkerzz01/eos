// Assessments - SERVER Component (real, RLS-authorized rows -> client UI).
import { getAssessments } from '@/lib/data/assessments';
import { getStudents } from '@/lib/data/students';
import { getSubjects } from '@/lib/data/subjects';
import { AssessmentsClient } from './AssessmentsClient';

export const dynamic = 'force-dynamic';

export default async function AssessmentsPage() {
  const [assessments, students, subjects] = await Promise.all([
    getAssessments(),
    getStudents(),
    getSubjects(),
  ]);
  return (
    <AssessmentsClient
      initialAssessments={assessments}
      students={students.map((s) => ({ id: s.id, name: s.name }))}
      subjects={subjects}
    />
  );
}
