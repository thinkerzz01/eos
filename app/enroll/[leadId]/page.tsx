// Public enrollment page. SERVER component: it looks the lead up by the id in the
// link BEFORE rendering anything, so it can (a) pre-fill the form with the family's
// booking data and (b) refuse a link whose id is invalid, deleted, or already
// enrolled - instead of the old behaviour of showing a blank form for ANY url.
//
// The id in the url is an unguessable UUID and is the capability to enrol this
// lead; we read the row with the service-role client (the page is anonymous) and
// gate on the same rules the submit routine enforces (exists + not yet converted).
import { createAdminClient } from '@/lib/supabase/admin';
import { EnrollForm, type EnrollInitial } from './EnrollForm';
import { AlertCircle, MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const HELP_WA = (process.env.NEXT_PUBLIC_ACADEMY_WHATSAPP || '923262324477').replace(/\D/g, '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Gate =
  | { kind: 'ok'; initial: EnrollInitial }
  | { kind: 'invalid' }
  | { kind: 'enrolled' };

async function resolveLead(leadId: string): Promise<Gate> {
  // A tampered / malformed id is never a valid link.
  if (!UUID_RE.test(leadId)) return { kind: 'invalid' };
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // No service-role key -> we cannot verify the lead; treat as invalid rather
    // than showing a blank form we cannot trust.
    return { kind: 'invalid' };
  }

  const { data, error } = await admin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return { kind: 'invalid' };
  const r = data as any;
  if (r.converted_student_id) return { kind: 'enrolled' };

  return {
    kind: 'ok',
    initial: {
      studentName: r.name ?? '',
      parentName: r.parent_name ?? '',
      phone: r.phone ?? '',
      email: r.email ?? '',
      program: r.program ?? '',
      city: r.city ?? '',
      // The booking captures "area" (town/society); seed it into the address field.
      address: r.area ?? '',
    },
  };
}

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FD] text-[#171A2B] font-sans flex flex-col justify-between">
      <header className="bg-white border-b border-[#EBEDF3] py-4 px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <img src="/logo-light.png" alt="Thinkerzz" className="h-9 w-auto object-contain" />
          <div className="text-xs font-medium text-[#5B47D6] tracking-wider uppercase border-l border-slate-200 pl-3">Student Enrollment</div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">{children}</main>
      <footer className="border-t border-[#EBEDF3] py-4 text-center text-xs text-slate-400 font-medium">
        Thinkerzz · All rights reserved.
      </footer>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  const wa = HELP_WA ? `https://wa.me/${HELP_WA}` : '';
  return (
    <div className="bg-white border border-[#EBEDF3] rounded-[24px] p-8 shadow-xl text-center space-y-4 max-w-xl mx-auto mt-6">
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-9 h-9" />
      </div>
      <h2 className="font-heading font-medium text-2xl text-slate-900">{title}</h2>
      <p className="text-sm text-[#6B7185] font-medium max-w-md mx-auto leading-relaxed">{body}</p>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 transition"
        >
          <MessageCircle className="w-4 h-4" /> Contact us on WhatsApp
        </a>
      )}
    </div>
  );
}

export default async function EnrollPage({ params }: { params: { leadId: string } }) {
  const gate = await resolveLead(params.leadId);

  return (
    <Chrome>
      {gate.kind === 'ok' ? (
        <EnrollForm leadId={params.leadId} initial={gate.initial} />
      ) : gate.kind === 'enrolled' ? (
        <Notice
          title="Already Enrolled"
          body="This student has already completed enrollment. If you think this is a mistake, please contact the academy."
        />
      ) : (
        <Notice
          title="Invalid or Expired Link"
          body="This enrollment link is not valid. Please use the exact link the academy sent you, or contact us and we'll share a fresh one."
        />
      )}
    </Chrome>
  );
}
