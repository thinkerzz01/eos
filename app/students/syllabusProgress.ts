'use server';

// Server action: load a student's read-only syllabus progress for the staff
// profile view. RLS on the underlying tables enforces access (a teacher only
// sees their own students; admin/manager see all).
import { getSyllabusForStudent, type MySubject } from '@/lib/data/studentSyllabus';

export async function loadStudentSyllabus(studentId: string): Promise<MySubject[]> {
  if (!studentId) return [];
  return getSyllabusForStudent(studentId);
}
