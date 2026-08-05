'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { createClient } from '@/lib/supabase/client';
import { saveSettings } from './actions';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Lock,
  Zap,
  Key,
  Building,
  DollarSign,
  Bell,
  CheckCircle2,
  Save,
  Globe,
  Sliders,
} from 'lucide-react';

export default function SettingsPage() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<'Branding' | 'Financial' | 'Security' | 'API' | 'Notifications'>('Branding');

  // FORM STATES
  const [academyName, setAcademyName] = useState('Thinkerzz Academy');
  const [tagline, setTagline] = useState('Question. Think. Achieve.');
  const [academicYear, setAcademicYear] = useState('Academic Year 2026');
  const [timezone, setTimezone] = useState('PKT (Asia/Karachi, +05:00)');
  const [currency, setCurrency] = useState('PKR - Pakistani Rupee');

  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [defaultTargetGrade, setDefaultTargetGrade] = useState('A*');
  const [cronSecret, setCronSecret] = useState('thinkerzz-cron-secret-token-998877');
  const [resendCap, setResendCap] = useState(100);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Load current values from the DB (admin session; RLS-scoped).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: org } = await supabase.from('orgs').select('name,academic_year').limit(1).maybeSingle();
      if (org?.name) setAcademyName(org.name);
      if (org?.academic_year) setAcademicYear(org.academic_year);
      const { data: st } = await supabase.from('settings').select('grace_days').limit(1).maybeSingle();
      if (st?.grace_days != null) setGracePeriodDays(st.grace_days);
    })();
  }, []);

  // RLS DENIAL CHECK FOR MANAGERS
  if (role === 'manager') {
    return (
      <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
        <div className="p-8 max-w-lg mx-auto text-center bg-white border border-rose-200 rounded-3xl shadow-xl space-y-4 my-12">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Access Denied (RLS Level Security)</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            Per <strong>AGENTS.md §3.3</strong>, Manager tokens are strictly denied access at the database level to <code className="bg-slate-100 px-1 py-0.5 rounded">settings</code> and <code className="bg-slate-100 px-1 py-0.5 rounded">audit_log</code>.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await saveSettings({ academyName, academicYear, gracePeriodDays });
    setSaving(false);
    if (res.ok) {
      alert('Settings saved (academy name, academic year, grace-period days persisted).');
      router.refresh();
    } else {
      alert(res.error ?? 'Failed to save settings.');
    }
  };

  return (
    <PortalLayout title="" subtitle="" allowedRoles={['admin']}>
      <div className="space-y-5 text-[#171A2B] dark:text-slate-100 max-w-full overflow-x-hidden pb-12">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] shadow-sm">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Central System Configuration & Settings</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Manage academy branding, financial rules, security policies, API secrets, and notification engines.
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
          </button>
        </div>

        {/* 5 CONFIGURATION TABS */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 text-xs font-extrabold flex-wrap">
            {[
              { id: 'Branding', label: '🏢 Academy Branding & Info' },
              { id: 'Financial', label: '💰 Fee & Financial Policies' },
              { id: 'Security', label: '🛡️ Security & Role Matrix' },
              { id: 'API', label: '🔑 API Secrets & Integrations' },
              { id: 'Notifications', label: '📢 Notifications & Adapters' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#5B47D6] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: ACADEMY BRANDING & GENERAL SETTINGS */}
          {activeTab === 'Branding' && (
            <div className="space-y-4 max-w-2xl text-xs font-bold animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Academy Name</label>
                  <input type="text" value={academyName} onChange={(e) => setAcademyName(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Tagline</label>
                  <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Academic Year</label>
                  <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Timezone (AGENTS.md §3.2)</label>
                  <input type="text" disabled value={timezone} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Currency</label>
                  <input type="text" disabled value={currency} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL & FEE POLICIES */}
          {activeTab === 'Financial' && (
            <div className="space-y-4 max-w-2xl text-xs font-bold animate-in fade-in">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1 text-purple-900">
                <div className="font-extrabold uppercase text-[11px]">Locked Financial Invariants</div>
                <div className="text-[11.5px] font-medium leading-relaxed">
                  • 3-Day Grace Period score: <strong>100 Fee Timeliness</strong><br />
                  • Expired Grace action: Raises Admin Decision card (Stop / Extend / Mark Paid)<br />
                  • Default Target Grade at enrollment: <strong>A*</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Grace Period Duration (Days)</label>
                  <input type="number" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(parseInt(e.target.value))} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Default Target Grade</label>
                  <input type="text" value={defaultTargetGrade} onChange={(e) => setDefaultTargetGrade(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & ROLE MATRIX */}
          {activeTab === 'Security' && (
            <div className="space-y-4 max-w-2xl text-xs font-bold animate-in fade-in">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs font-extrabold text-emerald-400">
                  <span>Postgres RLS Security Status</span>
                  <span>🟢 ENABLED (Deny-by-Default)</span>
                </div>
                <div className="text-[11.5px] text-slate-300 font-medium">
                  Every table carries `org_id` multi-tenancy and deny-by-default policies. Managers are denied on all finance, pay rates, settings, and audit logs.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API SECRETS & INTEGRATIONS */}
          {activeTab === 'API' && (
            <div className="space-y-4 max-w-2xl text-xs font-bold animate-in fade-in">
              <div>
                <label className="text-slate-700 block mb-1">cPanel Cron Bearer Secret Token (Authorization: Bearer)</label>
                <input type="text" value={cronSecret} onChange={(e) => setCronSecret(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 font-mono text-slate-900" />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Resend Daily Free Tier Cap Threshold</label>
                <input type="number" value={resendCap} onChange={(e) => setResendCap(parseInt(e.target.value))} className="w-full bg-slate-50 border rounded-xl p-2.5 font-mono text-slate-900" />
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS & ADAPTERS */}
          {activeTab === 'Notifications' && (
            <div className="space-y-4 max-w-2xl text-xs font-bold animate-in fade-in">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-emerald-900">
                <div className="font-extrabold">Queue Drainage Rules</div>
                <div className="text-[11.5px] font-medium">
                  Adapter drains Priority 1 fully, then Priority 2, then Priority 3. Templates enforce <code className="bg-white px-1 py-0.5 rounded font-mono font-bold text-slate-800">{"{{student_name}}"}</code> and <code className="bg-white px-1 py-0.5 rounded font-mono font-bold text-slate-800">{"{{pronoun}}"}</code> merge fields.
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </PortalLayout>
  );
}
