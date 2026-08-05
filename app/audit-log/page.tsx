// Audit Log — SERVER Component (real, RLS-authorized rows -> client UI).
import { getAuditLog } from '@/lib/data/auditLog';
import { AuditLogClient } from './AuditLogClient';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const logs = await getAuditLog();
  return <AuditLogClient initialLogs={logs} />;
}
