// Audit log data-access - RLS-enforced, server-only. Admin-only (Manager DENIED
// at the DB). Append-only; read newest first.
import { createClient } from '@/lib/supabase/server';
import type { AuditLogEntry } from '@/lib/mockSupportData';

function mapRow(r: any): AuditLogEntry {
  return {
    id: r.id,
    action: r.action,
    actorName: r.performed_by ?? 'System',
    actorRole: '',
    targetTable: r.table_name,
    timestamp: r.created_at,
    ipAddress: '',
    details: r.diff ? JSON.stringify(r.diff).slice(0, 200) : '',
  };
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('audit_log')
    .select('id,table_name,record_id,action,performed_by,diff,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
