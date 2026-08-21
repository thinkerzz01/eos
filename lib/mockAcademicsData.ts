// Central Academics Mock Store for Phase 4 (Schedule, Class Completion, Homework, Assessments)

export interface ScheduledClass {
  id: string;
  classCode: string;
  studentId?: string;
  studentName?: string;
  subject: string;
  program: string;
  grade: string;
  teacherId: string;
  teacherName: string;
  subjectId?: string;
  classType: 'Class' | 'Makeup' | 'Test';
  startAt: string; // PKT formatted time
  endAt: string;
  date: string;
  startAtISO?: string; // raw UTC ISO - used to prefill the edit form
  endAtISO?: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  room: string;
  isCharged: boolean; // false for Makeup classes!
  enrolledStudentsCount: number;
  meetingLink: string; // '' when the class did not sync to Google Calendar
  attendanceStatus?: 'present' | 'late' | 'absent' | ''; // recorded mark, if any
  classNote?: string; // teacher's note for this class, if any
}

export interface HomeworkAssignment {
  id: string;
  homeworkCode: string;
  subject: string;
  subjectId?: string;
  program: string;
  title: string;
  studentName?: string;
  studentId?: string;
  assignedDate: string;
  dueDate: string;
  dueISO?: string; // raw UTC ISO - prefills the edit form + powers date filter
  teacherName: string;
  teacherId?: string;
  totalSubmissions: number;
  gradedCount: number;
  submissionStatus?: 'Not submitted' | 'Submitted' | 'Graded';
  status: 'Assigned' | 'Graded' | 'Closed';
}

export interface AssessmentRecord {
  id: string;
  testCode: string;
  testTitle: string;
  subject: string;
  program: string;
  dateConducted: string;
  totalMarks: number;
  teacherName: string;
  grades: {
    testId?: string; // the underlying tests row id (for edit/delete)
    studentId: string;
    studentName: string;
    marksObtained: number;
    maxScore?: number;
    assessedGrade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  }[];
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_SCHEDULED_CLASSES: ScheduledClass[] = [];
export const MOCK_HOMEWORKS: HomeworkAssignment[] = [];
export const MOCK_ASSESSMENTS: AssessmentRecord[] = [];
