// Leads data-access (RLS-enforced, server-only). Pattern: see lib/data/students.ts.
import { createClient } from '@/lib/supabase/server';
import type { Lead } from '@/lib/mockAdmissionsData';

interface LeadRow {
  id: string;
  code?: string | null;
  name: string;
  parent_name: string | null;
  phone: string;
  email: string | null;
  program: string | null;
  subjects: string | null;
  source: 'google' | 'facebook' | 'instagram' | 'whatsapp' | 'referral' | 'walk_in';
  status: 'new' | 'contacted' | 'demo_booked' | 'won' | 'lost';
  temperature: 'hot' | 'warm' | 'cold';
  next_follow_up: string | null;
  lost_reason: string | null;
  created_at: string;
}

const STAGE_UI: Record<LeadRow['status'], Lead['stage']> = {
  new: 'New',
  contacted: 'Contacted',
  demo_booked: 'Demo Set',
  won: 'Won',
  lost: 'Lost',
};

const SOURCE_UI: Record<LeadRow['source'], Lead['source']> = {
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  walk_in: 'Walk-in',
  google: 'Google',
  instagram: 'Instagram',
};

function mapRow(r: LeadRow): Lead {
  return {
    id: r.id,
    leadId: r.code ?? `LD-${r.id.split('-')[0].toUpperCase()}`,
    parentName: r.parent_name ?? '',
    parentPhone: r.phone,
    parentEmail: r.email ?? '',
    studentName: r.name,
    program: r.program ?? '',
    grade: r.program ?? '',
    subjects: r.subjects ? r.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
    stage: STAGE_UI[r.status] ?? 'New',
    temperature: (r.temperature.charAt(0).toUpperCase() + r.temperature.slice(1)) as Lead['temperature'],
    source: SOURCE_UI[r.source] ?? 'Walk-in',
    createdDate: r.created_at,
    notes: r.lost_reason ?? '',
  };
}

export async function getLeads(): Promise<Lead[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('leads')
    .select('id,code,name,parent_name,phone,email,program,subjects,source,status,temperature,next_follow_up,lost_reason,created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as LeadRow[]).map(mapRow);
}
