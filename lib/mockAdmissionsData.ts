// Mock Admissions Store for Phase 3 (Leads CRM, Demos & Public Booking)

export interface Lead {
  id: string;
  leadId: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  studentName: string;
  program: string;
  grade: string;
  subjects: string[];
  stage: 'New' | 'Contacted' | 'Demo Set' | 'Demo Done' | 'Won' | 'Lost';
  temperature: 'Hot' | 'Warm' | 'Cold';
  source: 'Public Booking' | 'WhatsApp' | 'Walk-in' | 'Facebook' | 'Referral';
  createdDate: string;
  notes: string;
  assignedTeacherId?: string;
  assignedTeacherName?: string;
}

export interface DemoSession {
  id: string;
  demoId: string;
  leadId: string;
  studentName: string;
  parentName: string;
  parentPhone: string;
  program: string;
  subject: string;
  teacherId: string | null; // NULL for public unassigned bookings
  teacherName: string | null;
  scheduledTime: string; // ISO string or formatted PKT time
  durationMinutes: number;
  meetingLink: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Reassigned';
  outcome?: 'Won' | 'Lost' | 'No-show' | 'Pending';
  feedback?: string;
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_LEADS: Lead[] = [];
export const MOCK_DEMOS: DemoSession[] = [];
export const MOCK_OPEN_SLOTS: any[] = [];
