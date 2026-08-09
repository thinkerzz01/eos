'use client';

// Admin/manager "Reset password" control for a teacher or student row.
// Opens a small dialog with two choices:
//   - Send reset email  (person picks their own new password via a link)
//   - Generate temp password (shown ONCE here for the admin to relay)
// Passwords are never retrieved - only reset. Render only when the row has an email.
import React, { useState } from 'react';
import { KeyRound, Mail, Copy, Check, X } from 'lucide-react';
import { adminResetPassword } from '@/app/_actions/passwordActions';
import { useToast } from '@/components/ui/Toast';

export function ResetPasswordControl({
  id,
  kind,
  label = 'Reset Password',
  variant = 'menu',
}: {
  id: string;
  kind: 'teacher' | 'student';
  label?: string;
  variant?: 'menu' | 'icon';
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (mode: 'email' | 'temp') => {
    setBusy(true);
    setTemp(null);
    try {
      const res = await adminResetPassword({ id, kind, mode });
      if (!res.ok) {
        showToast(res.error ?? 'Could not reset the password.', 'error');
      } else if (mode === 'email') {
        showToast('Reset link sent to their email.', 'success');
        setOpen(false);
      } else if (res.tempPassword) {
        setTemp(res.tempPassword);
        setTempEmail(res.email ?? null);
      }
    } catch {
      showToast('Could not reset the password.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!temp) return;
    try {
      await navigator.clipboard.writeText(temp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - user can select manually */
    }
  };

  const close = () => {
    setOpen(false);
    setTemp(null);
    setTempEmail(null);
    setCopied(false);
  };

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={label}
          className="w-7 h-7 rounded-lg bg-[#FEF3E7] text-[#C2740C] flex items-center justify-center border border-[#F7D9AE] hover:bg-[#FBE7CC]"
        >
          <KeyRound className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg"
        >
          <KeyRound className="w-4 h-4 text-slate-400" />
          <span>{label}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset password</h3>
                <p className="mt-0.5 text-xs text-slate-500 break-all">
                  {tempEmail ?? `Reset this ${kind}'s portal password`}
                </p>
              </div>
              <button onClick={close} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!temp ? (
              <div className="mt-4 space-y-2">
                <button
                  disabled={busy}
                  onClick={() => run('email')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-50"
                >
                  <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Send reset email</span>
                    <span className="block text-xs text-slate-500">They pick a new password via a link. Most secure.</span>
                  </span>
                </button>
                <button
                  disabled={busy}
                  onClick={() => run('temp')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-50"
                >
                  <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Generate temporary password</span>
                    <span className="block text-xs text-slate-500">Shown once here for you to relay. They change it after.</span>
                  </span>
                </button>
                {busy && <p className="pt-1 text-center text-xs text-slate-400">Working...</p>}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Temporary password (shown once)
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900 break-all">
                    {temp}
                  </code>
                  <button
                    onClick={copy}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                    title="Copy"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Share this with the user (WhatsApp/call). Ask them to change it after signing in.
                  It will not be shown again.
                </p>
                <button
                  onClick={close}
                  className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
