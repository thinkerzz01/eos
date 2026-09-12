'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'brand';

export interface ToastAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}
export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Per-type palette. Full class strings (no dynamic interpolation) so Tailwind
// keeps them. Card is a soft tint; title stays neutral/dark for readability.
const STYLES: Record<
  ToastType,
  { card: string; iconWrap: string; burst: string; accentText: string; accentBtnBorder: string; bar: string; icon: React.ReactNode }
> = {
  success: {
    card: 'bg-emerald-50/80 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    iconWrap: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    burst: 'bg-emerald-400/70',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    accentBtnBorder: 'border-emerald-200 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    icon: <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} />,
  },
  error: {
    card: 'bg-rose-50/80 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20',
    iconWrap: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400',
    burst: 'bg-rose-400/70',
    accentText: 'text-rose-700 dark:text-rose-300',
    accentBtnBorder: 'border-rose-200 dark:border-rose-500/30',
    bar: 'bg-rose-500',
    icon: <AlertCircle className="w-5 h-5" strokeWidth={2.5} />,
  },
  info: {
    card: 'bg-sky-50/80 border-sky-100 dark:bg-sky-500/10 dark:border-sky-500/20',
    iconWrap: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400',
    burst: 'bg-sky-400/70',
    accentText: 'text-sky-700 dark:text-sky-300',
    accentBtnBorder: 'border-sky-200 dark:border-sky-500/30',
    bar: 'bg-sky-500',
    icon: <Info className="w-5 h-5" strokeWidth={2.5} />,
  },
  brand: {
    card: 'bg-[#F3F1FC] border-[#E4DFF8] dark:bg-[#5B47D6]/15 dark:border-[#5B47D6]/25',
    iconWrap: 'bg-[#E4DFF8] text-[#5B47D6] dark:bg-[#5B47D6]/25 dark:text-[#b9adf2]',
    burst: 'bg-[#7F77DD]/70',
    accentText: 'text-[#5B47D6] dark:text-[#b9adf2]',
    accentBtnBorder: 'border-[#E4DFF8] dark:border-[#5B47D6]/30',
    bar: 'bg-[#5B47D6]',
    icon: <Sparkles className="w-5 h-5" strokeWidth={2.5} />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', opts?: ToastOptions) => {
      const id = Math.random().toString(36).substring(2, 9);
      const duration = opts?.duration ?? (opts?.action ? 6500 : 4200);
      setToasts((prev) => [...prev, { id, title: message, description: opts?.description, type, action: opts?.action }]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const runAction = (t: Toast) => {
    if (t.action?.href) window.open(t.action.href, '_blank', 'noopener');
    t.action?.onClick?.();
    removeToast(t.id);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <style>{`@keyframes tzToastBar{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>

      <div className="fixed z-[70] top-3 sm:top-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex flex-col gap-2.5 w-[calc(100%-1.5rem)] max-w-[420px] pointer-events-none">
        {toasts.map((toast) => {
          const s = STYLES[toast.type];
          const duration = toast.action ? 6500 : 4200;
          const ActionBtn = toast.action ? (
            <button
              onClick={() => runAction(toast)}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-white/90 dark:bg-white/10 border ${s.accentBtnBorder} ${s.accentText} px-3 py-1.5 text-[13px] font-medium hover:bg-white dark:hover:bg-white/20 transition-colors whitespace-nowrap`}
            >
              {toast.action.icon}
              <span>{toast.action.label}</span>
            </button>
          ) : null;

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border ${s.card} shadow-[0_12px_32px_-10px_rgba(23,26,43,0.28)] backdrop-blur-sm pl-3.5 pr-9 py-3 animate-in fade-in slide-in-from-top-2 sm:slide-in-from-right-3 duration-300`}
            >
              {/* close */}
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss"
                className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3">
                {/* icon + burst */}
                <span className="relative shrink-0 mt-0.5">
                  <span aria-hidden className={`absolute -top-0.5 left-1 w-2 h-[2px] rounded-full rotate-[-35deg] ${s.burst}`} />
                  <span aria-hidden className={`absolute -top-1 right-0.5 w-1.5 h-[2px] rounded-full rotate-[30deg] ${s.burst}`} />
                  <span aria-hidden className={`absolute top-1 -right-1 w-1.5 h-[2px] rounded-full ${s.burst}`} />
                  <span className={`grid place-items-center w-9 h-9 rounded-full ${s.iconWrap}`}>{s.icon}</span>
                </span>

                {/* text */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 break-words">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-500 dark:text-slate-400 break-words">{toast.description}</p>
                  )}
                  {/* action — stacks under the text on narrow screens */}
                  {ActionBtn && <div className="mt-2.5 sm:hidden">{ActionBtn}</div>}
                </div>

                {/* action — inline on wider screens */}
                {ActionBtn && <div className="hidden sm:flex self-center pr-1">{ActionBtn}</div>}
              </div>

              {/* auto-dismiss progress */}
              <span
                className={`absolute bottom-0 left-0 h-[3px] w-full origin-left ${s.bar} opacity-60`}
                style={{ animation: `tzToastBar ${duration}ms linear forwards` }}
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
