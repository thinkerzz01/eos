// Central Support & Polish Mock Store for Phase 7 (Tickets, Announcements, Audit Log)

export interface SupportTicket {
  id: string;
  ticketNo: string;
  subject: string;
  submittedBy: string;
  userRole: 'Student' | 'Parent' | 'Teacher';
  category: 'Fee Voucher' | 'Schedule Conflict' | 'Portal Access' | 'Academic Progress';
  priority: 'Urgent' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string; // ISO or PKT time
  elapsedMinutes: number; // For 1-hour response target SLA check!
  isPastTarget: boolean; // True if > 60 minutes during 7 AM - 11 PM window
  messagesCount: number;
  messages?: { id: string; body: string; at: string }[];
}

export interface AcademyAnnouncement {
  id: string;
  title: string;
  content: string;
  targetAudience: 'All' | 'Students' | 'Teachers' | 'Parents';
  publishedDate: string;
  isPinned: boolean;
  authorName: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetTable: string;
  timestamp: string;
  ipAddress: string;
  details: string;
}


// Dummy data removed. Populate via the app / real database.
export const MOCK_TICKETS: SupportTicket[] = [];
export const MOCK_ANNOUNCEMENTS: AcademyAnnouncement[] = [];
export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [];
