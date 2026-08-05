export interface EnrolledSubject {
  subject: string;
  teacherName: string;
  assessedGrade: string; // Blank "" for new students until first test!
  targetGrade: string; // Defaults to A*
  avgScore: number;
  assignments: string;
  quizScore: number;
  status: 'Excellent' | 'Good' | 'Needs Attention';
  trend: 'up' | 'stable' | 'down';
}

export interface TimelineItem {
  title: string;
  tag: string;
  tagBg: string;
  desc: string;
  detail: string;
  date: string;
  iconType: 'homework' | 'payment' | 'class' | 'assessment' | 'alert' | 'communication';
  color: string;
}

export interface StudentDoc {
  name: string;
  type: string;
  date: string;
  size: string;
  status: 'Verified' | 'Pending' | 'Expired';
  statusBg: string;
}

export interface Student {
  id: string;
  stuId: string;
  name: string;
  dob: string;
  gender: string;
  rollNo: string;
  admissionDate: string;
  parentName: string;
  motherName: string;
  parentPhone: string;
  motherPhone: string;
  parentEmail: string;
  parentRelation: string;
  prefLanguage: string;
  lastContact: string;
  program: string;
  grade: string;
  enrolledSubjects: EnrolledSubject[];
  attendancePct: number;
  homeworkPct: number;
  testsPct: number;
  assignmentsPct: number;
  masteryPct: number;
  performanceScore: number;
  feeStatus: 'Paid' | 'Due' | 'In Grace' | 'Stopped';
  feeDateText: string;
  nextClassTime: string;
  nextClassSubject: string;
  nextClassTeacher: string;
  nextClassRoom: string;
  aiTag: 'Excellent' | 'Needs attention' | 'Average' | 'At Risk' | 'Good' | 'Needs help';
  aiMessage: string;
  tags: string[];
  totalPaid: string;
  totalOutstanding: string;
  healthBand: 'Green' | 'Amber' | 'Red';
  status: 'active' | 'paused' | 'demo' | 'alumni';
  timeline: TimelineItem[];
  documents: StudentDoc[];
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_50_STUDENTS: Student[] = [];
