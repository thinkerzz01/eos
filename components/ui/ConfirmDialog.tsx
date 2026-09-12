'use client';

// App-wide confirmation dialog. Replaces the browser's native confirm() (the
// unbranded "portal.thinkerzz.com says" box) with a styled modal. Usage:
//
//   const { confirm } = useConfirm();
//   if (!(await confirm('Delete this class?'))) return;
//   // or, with options:
//   if (!(await confirm({ title: 'Delete student?', message: '…', danger: true }))) return;
//
// confirm() returns a Promise<boolean> that resolves true on confirm, false on
// cancel / backdrop / Escape.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // red confirm button for destructive actions (default true)
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      setPending({ ...normalized, resolve });
    });
  }, []);

  const close = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok);
        return null;
      });
    },
    []
  );

  // Escape cancels, Enter confirms while the dialog is open.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  const danger = pending?.danger !== false; // destructive by default

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in"
          onClick={() => close(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-[#EBEDF3] dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  danger ? 'bg-rose-100 text-rose-600' : 'bg-[#EEEBFB] text-[#5B47D6]'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-medium text-slate-900 dark:text-white text-lg leading-snug">
                  {pending.title ?? 'Are you sure?'}
                </h3>
                <p className="text-sm text-[#6B7185] dark:text-slate-400 mt-1 whitespace-pre-line leading-relaxed">
                  {pending.message}
                </p>
              </div>
              <button
                onClick={() => close(false)}
                aria-label="Close"
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg -mt-1 -mr-1"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => close(false)}
                className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                className={`px-5 py-2.5 text-xs font-medium text-white rounded-xl shadow-sm transition-all ${
                  danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#5B47D6] hover:bg-[#4F3DC7]'
                }`}
              >
                {pending.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
