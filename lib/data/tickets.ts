// Tickets data-access — RLS-enforced, server-only.
// SLA: 1-hour reply target across 7 AM-11 PM; past-target tickets flag red.
import { createClient } from '@/lib/supabase/server';
import type { SupportTicket } from '@/lib/mockSupportData';

const STATUS_UI: Record<string, SupportTicket['status']> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
const PRIORITY_UI: Record<string, SupportTicket['priority']> = {
  urgent: 'Urgent',
  high: 'Urgent',
  normal: 'Medium',
  low: 'Low',
};

function mapRow(r: any): SupportTicket {
  const created = new Date(r.created_at).getTime();
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - created) / 60000));
  const isPastTarget =
    (r.status === 'open' || r.status === 'in_progress') &&
    Date.now() > new Date(r.target_reply_at).getTime();
  return {
    id: r.id,
    ticketNo: `TK-${String(r.id).split('-')[0].toUpperCase()}`,
    subject: r.subject,
    submittedBy: '',           // profiles join (later slice)
    userRole: 'Parent',
    category: 'Portal Access',
    priority: PRIORITY_UI[r.priority as string] ?? 'Medium',
    status: STATUS_UI[r.status as string] ?? 'Open',
    createdAt: r.created_at,
    elapsedMinutes,
    isPastTarget,
    messagesCount: Array.isArray(r.ticket_messages) ? (r.ticket_messages[0]?.count ?? 0) : 0,
  };
}

export async function getTickets(): Promise<SupportTicket[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tickets')
    .select('id,subject,opened_by,status,priority,target_reply_at,created_at,ticket_messages(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as any[]).map(mapRow);
}
