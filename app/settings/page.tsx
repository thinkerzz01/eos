'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { useRole } from '@/components/ui/RoleContext';
import { createClient } from '@/lib/supabase/client';
import { saveSettings, sendTestEmail } from './actions';
import { FONT_OPTIONS, DEFAULT_HEADING_FONT, DEFAULT_BODY_FONT } from '@/lib/fonts';
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
  Download as DownloadIcon,
} from 'lucide-react';

export default function SettingsPage() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState<'Branding' | 'Financial' | 'Security' | 'API' | 'Notifications'>('Branding');

  // FORM STATES
  const [academyName, setAcademyName] = useState('Thinkerzz');
  const [academicYear, setAcademicYear] = useState('Academic Year 2026');
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [bankTitle, setBankTitle] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [walletInfo, setWalletInfo] = useState('');
  const [headingFont, setHeadingFont] = useState<string>(DEFAULT_HEADING_FONT);
  const [bodyFont, setBodyFont] = useState<string>(DEFAULT_BODY_FONT);
  const [saving, setSaving] = useState(false);

  // Global text size (root font scale) - reflects on every tab. Persisted locally.
  const [uiScale, setUiScale] = useState<number>(100);
  useEffect(() => {
    const saved = Number(localStorage.getItem('tz-ui-scale')) || 100;
    setUiScale(saved);
  }, []);
  const applyScale = (pct: number) => {
    setUiScale(pct);
    localStorage.setItem('tz-ui-scale', String(pct));
    document.documentElement.style.fontSize = `${pct}%`;
  };

  // Test-email tool (verify Resend delivery after domain verification)
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult('');
    const res = await sendTestEmail(testEmail);
    setTesting(false);
    setTestResult(res.ok ? `✓ ${res.info ?? 'Sent.'}` : `✗ ${res.error ?? 'Failed.'}`);
  };

  // Reference-only values. These are shown for context but NOT persisted (no
  // schema columns for them). The cron secret lives in the CRON_SECRET_TOKEN env
  // var and is deliberately never shown or stored in the database.
  const tagline = 'Question. Think. Achieve.';
  const timezone = 'PKT (Asia/Karachi, +05:00)';
  const currency = 'PKR - Pakistani Rupee';
  const defaultTargetGrade = 'A*';
  const resendCap = 100;
  const router = useRouter();

  // Load current values from the DB (admin session; RLS-scoped).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // select('*') so heading_font/body_font simply come back undefined (no 400)
      // until the typography migration runs.
      const { data: org } = await supabase.from('orgs').select('*').limit(1).maybeSingle();
      if (org?.name) setAcademyName(org.name);
      if (org?.academic_year) setAcademicYear(org.academic_year);
      if (org?.heading_font) setHeadingFont(org.heading_font);
      if (org?.body_font) setBodyFont(org.body_font);
      // select('*') returns whatever columns exist, so the bank_* fields simply
      // come back undefined (no 400) until the settings_bank_info migration runs.
      const { data: st } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (st?.grace_days != null) setGracePeriodDays(st.grace_days);
      if (st?.bank_title) setBankTitle(st.bank_title);
      if (st?.bank_account_no) setBankAccountNo(st.bank_account_no);
      if (st?.bank_iban) setBankIban(st.bank_iban);
      if (st?.wallet_info) setWalletInfo(st.wallet_info);
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
          <h2 className="font-heading font-medium text-xl text-slate-900">Access restricted</h2>
          <p className="text-xs text-[#6B7185] leading-relaxed">
            Settings are visible to the Admin only. Please contact the academy owner if you need access.
          </p>
        </div>
      </PortalLayout>
    );
  }

  const handleSaveSettings = async () => {
    setSaving(true);
    const res = await saveSettings({ academyName, academicYear, gracePeriodDays, bankTitle, bankAccountNo, bankIban, walletInfo, headingFont, bodyFont });
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
            <h1 className="font-heading font-medium text-2xl text-slate-900 dark:text-white flex items-center gap-2">
              <span>Central System Configuration & Settings</span>
            </h1>
            <p className="text-xs text-[#6B7185] dark:text-slate-400 font-medium mt-0.5">
              Manage academy branding, financial rules, security policies, API secrets, and notification engines.
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="h-[38px] px-4 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white text-xs font-medium rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        {/* 5 CONFIGURATION TABS */}
        <div className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-[18px] p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 text-xs font-medium flex-wrap">
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
            <div className="space-y-4 max-w-2xl text-xs font-medium animate-in fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Academy Name</label>
                  <input type="text" value={academyName} onChange={(e) => setAcademyName(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Tagline <span className="text-slate-400 normal-case font-medium">(reference only)</span></label>
                  <input type="text" disabled value={tagline} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Academic Year</label>
                  <input type="text" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Timezone</label>
                  <input type="text" disabled value={timezone} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Currency</label>
                  <input type="text" disabled value={currency} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
              </div>

              {/* TYPOGRAPHY - heading + body fonts, applied portal-wide on Save */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-medium text-sm normal-case">
                  <Sliders className="w-4 h-4 text-[#5B47D6]" />
                  <span>Typography (fonts for the whole portal)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 block mb-1">Heading font</label>
                    <select value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-medium normal-case">
                      {FONT_OPTIONS.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1">Body font</label>
                    <select value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-medium normal-case">
                      {FONT_OPTIONS.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
                    </select>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="font-heading text-lg text-slate-900 normal-case">Aa — Heading preview</div>
                  <p className="text-sm text-slate-600 font-normal normal-case mt-0.5">The quick brown fox jumps over the lazy dog — body text preview.</p>
                </div>
                <p className="text-[11px] text-slate-400 normal-case font-medium">Defaults: Nunito headings, Jost body. Applies across the whole portal after you press Save.</p>
              </div>

              {/* GLOBAL TEXT SIZE - applies to every tab, saved on this device */}
              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-medium text-sm normal-case">
                  <Sliders className="w-4 h-4 text-[#5B47D6]" />
                  <span>Text Size (applies to the whole portal)</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[{ p: 100, l: 'Default' }, { p: 110, l: 'Large' }, { p: 120, l: 'Larger' }, { p: 130, l: 'Largest' }].map((o) => (
                    <button
                      key={o.p}
                      onClick={() => applyScale(o.p)}
                      className={`px-4 py-2 rounded-xl border text-xs font-medium transition-colors normal-case ${uiScale === o.p ? 'bg-[#5B47D6] text-white border-[#5B47D6]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {o.l} <span className="opacity-70">({o.p}%)</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 font-medium normal-case">Saved on this device and applied instantly across every tab.</p>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL & FEE POLICIES */}
          {activeTab === 'Financial' && (
            <div className="space-y-4 max-w-2xl text-xs font-medium animate-in fade-in">
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1 text-purple-900">
                <div className="font-medium uppercase text-xs">Locked Financial Invariants</div>
                <div className="text-xs font-medium leading-relaxed">
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
                  <label className="text-slate-700 block mb-1">Default Target Grade <span className="text-slate-400 normal-case font-medium">(reference only)</span></label>
                  <input type="text" disabled value={defaultTargetGrade} className="w-full bg-slate-100 border rounded-xl p-2.5 text-slate-700 cursor-not-allowed" />
                </div>
              </div>

              {/* BANK / PAYMENT DETAILS (shown on fee vouchers) */}
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-medium text-sm normal-case">
                  <Building className="w-4 h-4 text-[#5B47D6]" />
                  <span>Bank & Payment Details</span>
                </div>
                <p className="text-xs text-slate-500 font-medium normal-case">These appear on every fee voucher under "How to pay". Leave blank to hide a line.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 block mb-1 normal-case">Bank Title (Account Holder + Bank)</label>
                    <input type="text" value={bankTitle} onChange={(e) => setBankTitle(e.target.value)} placeholder="e.g. Muhammad Owais - UBL" className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-medium" />
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1 normal-case">Bank Account Number</label>
                    <input type="text" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} placeholder="e.g. 0975299145109" className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-mono font-medium" />
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1 normal-case">IBAN</label>
                    <input type="text" value={bankIban} onChange={(e) => setBankIban(e.target.value)} placeholder="e.g. PK32UNIL0109000299145109" className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-mono font-medium" />
                  </div>
                  <div>
                    <label className="text-slate-700 block mb-1 normal-case">JazzCash / Mobile Wallet</label>
                    <input type="text" value={walletInfo} onChange={(e) => setWalletInfo(e.target.value)} placeholder="e.g. JazzCash: 03216698189 (Title: ...)" className="w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-medium" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & ROLE MATRIX */}
          {activeTab === 'Security' && (
            <div className="space-y-4 max-w-2xl text-xs font-medium animate-in fade-in">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="flex justify-between items-center text-xs font-medium text-emerald-400">
                  <span>Data Security</span>
                  <span>🟢 Protected</span>
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  Every record is scoped to your academy, and finance, pay, settings and audit data are limited to the Admin. Access is enforced by the database, not just the screen.
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: API SECRETS & INTEGRATIONS */}
          {activeTab === 'API' && (
            <div className="space-y-4 max-w-2xl text-xs font-medium animate-in fade-in">
              <div>
                <label className="text-slate-700 block mb-1">cPanel Cron Bearer Secret Token (Authorization: Bearer)</label>
                <input type="text" disabled value="•••••••••• - set via the CRON_SECRET_TOKEN env var (never stored here)" className="w-full bg-slate-100 border rounded-xl p-2.5 font-mono text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="text-slate-700 block mb-1">Resend Daily Free Tier Cap Threshold <span className="text-slate-400 normal-case font-medium">(enforced in code)</span></label>
                <input type="number" disabled value={resendCap} className="w-full bg-slate-100 border rounded-xl p-2.5 font-mono text-slate-500 cursor-not-allowed" />
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="font-medium text-slate-800 normal-case">Data Backup</div>
                <p className="text-xs text-slate-500 font-medium normal-case">
                  Download a full copy of the database (every table) as a JSON file. This is the same
                  data the weekly cron backs up - use this to grab a copy on demand.
                </p>
                <a
                  href="/api/admin/backup"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5B47D6] hover:bg-[#4F3DC7] text-white px-4 py-2.5 text-xs font-medium shadow-sm transition normal-case"
                >
                  <DownloadIcon className="w-4 h-4" /> Download Full Backup
                </a>
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS & ADAPTERS */}
          {activeTab === 'Notifications' && (
            <div className="space-y-4 max-w-2xl text-xs font-medium animate-in fade-in">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1 text-emerald-900">
                <div className="font-medium">Queue Drainage Rules</div>
                <div className="text-xs font-medium">
                  Adapter drains Priority 1 fully, then Priority 2, then Priority 3. Templates enforce <code className="bg-white px-1 py-0.5 rounded font-mono font-medium text-slate-800">{"{{student_name}}"}</code> and <code className="bg-white px-1 py-0.5 rounded font-mono font-medium text-slate-800">{"{{pronoun}}"}</code> merge fields.
                </div>
              </div>

              {/* SEND TEST EMAIL - verify Resend delivery */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="font-medium text-slate-800">Send a test email</div>
                <div className="text-xs font-medium text-slate-500 normal-case">
                  Use this after verifying your Resend domain to confirm real delivery. Sends one email to the address below.
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 bg-slate-50 border rounded-xl p-2.5 text-slate-900 font-medium"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={testing}
                    className="px-4 py-2.5 bg-[#5B47D6] hover:bg-[#4F3DC7] text-white rounded-xl font-medium text-xs shadow-sm disabled:opacity-50"
                  >
                    {testing ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
                {testResult && (
                  <div className={`text-xs font-medium normal-case ${testResult.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {testResult}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </PortalLayout>
  );
}
