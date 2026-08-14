// Central Support & Polish Mock Store (Announcements, Audit Log).
// NOTE: the Support Ticket system was removed 2026-08-14 and archived to
// _archive/tickets/ (SupportTicket + MOCK_TICKETS live there for restore).

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
export const MOCK_ANNOUNCEMENTS: AcademyAnnouncement[] = [];
export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [];
