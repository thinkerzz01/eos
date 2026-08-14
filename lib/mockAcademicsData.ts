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
  classType: 'Class' | 'Makeup' | 'Test';
  startAt: string; // PKT formatted time
  endAt: string;
  date: string;
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  room: string;
  isCharged: boolean; // false for Makeup classes!
  enrolledStudentsCount: number;
  meetingLink: string; // '' when the class did not sync to Google Calendar
}

export interface HomeworkAssignment {
  id: string;
  homeworkCode: string;
  subject: string;
  program: string;
  title: string;
  assignedDate: string;
  dueDate: string;
  teacherName: string;
  totalSubmissions: number;
  gradedCount: number;
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
    studentId: string;
    studentName: string;
    marksObtained: number;
    assessedGrade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  }[];
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_SCHEDULED_CLASSES: ScheduledClass[] = [];
export const MOCK_HOMEWORKS: HomeworkAssignment[] = [];
export const MOCK_ASSESSMENTS: AssessmentRecord[] = [];
