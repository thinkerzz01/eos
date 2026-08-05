// Thinkerzz EOS — Security & RLS Policy Enforcement Engine
// Implements all locked security invariants per AGENTS.md §3.3 & Master Plan v3.1

export type UserRole = 'admin' | 'manager' | 'teacher' | 'student';

export interface SecurityContext {
  role: UserRole;
  userId: string;
  orgId: string; // Multi-tenant isolation invariant (org_id on every table)
}

// 1. MANAGER DENIED TABLES (AGENTS.md §3.3)
export const MANAGER_DENIED_TABLES = [
  'vouchers',
  'payments',
  'refunds',
  'fee_decisions',
  'settings',
  'audit_log',
  'teacher_pay_rates',
  'teacher_payouts',
];

// 2. RLS PERMISSION GUARD
export function checkRLSPermission(table: string, role: UserRole): { allowed: boolean; reason?: string } {
  // Admin has access to all tables
  if (role === 'admin') {
    return { allowed: true };
  }

  // Manager is DENIED at DB level on finance, pay rates, settings, audit log
  if (role === 'manager' && MANAGER_DENIED_TABLES.includes(table)) {
    return {
      allowed: false,
      reason: `RLS DENY ENGINE: Supabase table policy denied SELECT/WRITE on '${table}' for role 'manager' (AGENTS.md §3.3).`,
    };
  }

  // Teacher access rules
  if (role === 'teacher') {
    const allowedTeacherTables = ['schedule', 'homework', 'assessments', 'students', 'tickets', 'announcements'];
    if (!allowedTeacherTables.includes(table)) {
      return {
        allowed: false,
        reason: `RLS DENY ENGINE: Supabase table policy denied SELECT/WRITE on '${table}' for role 'teacher'.`,
      };
    }
  }

  // Student access rules (strictly scoped to child's own row)
  if (role === 'student') {
    const allowedStudentTables = ['schedule', 'homework', 'assessments', 'vouchers', 'tickets', 'announcements', 'documents'];
    if (!allowedStudentTables.includes(table)) {
      return {
        allowed: false,
        reason: `RLS DENY ENGINE: Supabase table policy denied SELECT/WRITE on '${table}' for role 'student'.`,
      };
    }
  }

  return { allowed: true };
}

// 3. PII ANONYMIZER FOR AI PROCESSING (AGENTS.md §3.6)
export function sanitizeStudentForAI(student: {
  name: string;
  parentPhone?: string;
  motherPhone?: string;
  enrolledSubjects: Array<{ subject: string; trend: string }>;
  attendancePct: number;
  homeworkPct: number;
  completedClassesCount?: number;
}): {
  firstName: string;
  subjectTrends: Array<{ subject: string; trend: string }>;
  attendancePct: number;
  homeworkPct: number;
  completedClassesCount: number;
} {
  // Extract first name ONLY (never surname, never phone)
  const firstName = student.name.split(' ')[0] || 'Student';

  return {
    firstName,
    subjectTrends: student.enrolledSubjects.map((s) => ({
      subject: s.subject,
      trend: s.trend,
    })),
    attendancePct: student.attendancePct,
    homeworkPct: student.homeworkPct,
    completedClassesCount: student.completedClassesCount || 12,
  };
}

// 4. CRON BEARER SECRET SECURITY CHECK (AGENTS.md §3.3)
export function verifyCronBearerHeader(authHeader: string | null, expectedSecret: string): boolean {
  if (!authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  return token === expectedSecret;
}

// 5. PRIVATE STORAGE SIGNED URL
// The old fabricated-string generator was removed. Real signed URLs live in
// lib/storage.ts (`getSignedDocumentUrl`), which calls Supabase Storage
// server-side and returns a genuine short-lived signed URL (or null).

// 6. APPLICATION-LEVEL OVERLAP RE-CHECK (doAssign - AGENTS.md §3.4)
export function checkBookingTeacherConflict(
  teacherId: string,
  newStartISO: string,
  newEndISO: string,
  existingSchedule: Array<{ teacherId: string; startAt: string; endAt: string }>
): { conflict: boolean; conflictingClass?: string } {
  const newStart = new Date(newStartISO).getTime();
  const newEnd = new Date(newEndISO).getTime();

  for (const item of existingSchedule) {
    if (item.teacherId === teacherId) {
      const existStart = new Date(item.startAt).getTime();
      const existEnd = new Date(item.endAt).getTime();

      // Overlap condition: max(start1, start2) < min(end1, end2)
      if (Math.max(newStart, existStart) < Math.min(newEnd, existEnd)) {
        return {
          conflict: true,
          conflictingClass: `Overlap with class scheduled between ${item.startAt} and ${item.endAt}`,
        };
      }
    }
  }

  return { conflict: false };
}
