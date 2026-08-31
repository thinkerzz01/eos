// Audit Log - SERVER Component (real, RLS-authorized rows -> client UI).
import { getAuditLog } from '@/lib/data/auditLog';
import { AuditLogClient } from './AuditLogClient';

export const dynamic = 'force-dynamic';

import { requireRole } from '@/lib/auth/requireRole';

export default async function AuditLogPage() {
  await requireRole(['admin']);
  const logs = await getAuditLog();
  return <AuditLogClient initialLogs={logs} />;
}
