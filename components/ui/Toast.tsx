'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'brand';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION = 4200;

// Per-type styling: a soft-tinted icon chip + a left accent bar + a matching
// progress bar. Card stays light/neutral so it reads as part of the app, not a
// generic dark notification pill.
const STYLES: Record<ToastType, { accent: string; chip: string; icon: React.ReactNode }> = {
  success: {
    accent: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  error: {
    accent: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  info: {
    accent: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    icon: <Info className="w-4 h-4" />,
  },
  brand: {
    accent: 'bg-[#5B47D6]',
    chip: 'bg-[#EEEBFB] text-[#5B47D6] dark:bg-[#5B47D6]/20 dark:text-[#b9adf2]',
    icon: <Sparkles className="w-4 h-4" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), DURATION);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Keyframes for the auto-dismiss progress bar. */}
      <style>{`@keyframes tzToastBar{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>

      <div className="fixed z-[70] top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-[380px] pointer-events-none">
        {toasts.map((toast) => {
          const s = STYLES[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#EBEDF3] dark:border-slate-700/70 bg-white dark:bg-slate-900 pl-4 pr-2.5 py-3 shadow-[0_10px_30px_-8px_rgba(23,26,43,0.25)] animate-in fade-in slide-in-from-top-2 sm:slide-in-from-right-3 duration-300"
            >
              {/* left accent bar */}
              <span className={`absolute inset-y-0 left-0 w-1 ${s.accent}`} />

              {/* icon chip */}
              <span className={`mt-0.5 shrink-0 grid place-items-center w-7 h-7 rounded-full ${s.chip}`}>
                {s.icon}
              </span>

              {/* message */}
              <p className="flex-1 min-w-0 text-sm font-medium leading-snug text-slate-800 dark:text-slate-100 pt-1 break-words">
                {toast.message}
              </p>

              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
                className="shrink-0 mt-0.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* auto-dismiss progress bar */}
              <span
                className={`absolute bottom-0 left-0 h-[3px] w-full origin-left ${s.accent} opacity-70`}
                style={{ animation: `tzToastBar ${DURATION}ms linear forwards` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
