// Central Intelligence Store for Phase 6 (Reports, AI Monthly Report Generator & Notification Queue)

export interface MonthlyReportData {
  studentId: string;
  firstName: string; // First name only for AI privacy! (No surname, no phone)
  program: string;
  month: string;
  topicsCovered: string[];
  testsConductedCount: number;
  gradeTrend: 'up' | 'same' | 'down';
  assessedGrade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  attendancePct: number;
  phrasedReportText?: string;
}

export interface NotificationItem {
  id: string;
  uniqueKey: string; // Idempotent key
  priority: 1 | 2 | 3; // Priority 1 drained first
  recipientEmail: string;
  templateName: string;
  messageBody: string; // Uses {{student_name}} and {{pronoun}}
  status: 'Pending' | 'Sent' | 'Failed' | 'Retrying';
  retryCount: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_MONTHLY_REPORTS: MonthlyReportData[] = [];
export const MOCK_NOTIFICATIONS: NotificationItem[] = [];
